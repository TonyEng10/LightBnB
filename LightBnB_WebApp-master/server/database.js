const properties = require('./json/properties.json');
const users = require('./json/users.json');
const { Pool } = require('pg');
/// Users

const pool = new Pool({
  user: 't853583',
  password: '5432',
  host: 'localhost',
  database: 'lightbnb',
  port: 5432,
});

pool.connect();


// pool.query(`SELECT title FROM properties LIMIT 10;`).then(response => {console.log(response)})

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
// const getUserWithEmail = function(email) {
//   let user;
//   for (const userId in users) {
//     user = users[userId];
//     if (user.email.toLowerCase() === email.toLowerCase()) {
//       break;
//     } else {
//       user = null;
//     }
//   }
//   return Promise.resolve(user);
// }
const getUserWithEmail = (email) => {
  return pool
  .query(`SELECT * FROM users WHERE email = $1`, [email])
  .then((result) => {
    // console.log(result.rows);
    return result.rows[0];
  })
  .catch((err) => {
    console.log(err.message);
  })
}

exports.getUserWithEmail = getUserWithEmail;
/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = (id) => {
  return pool
    .query(`SELECT * FROM users WHERE id = $1`, [id])
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.log(err.message);
    })
}

// const getUserWithId = function(id) {
//   return Promise.resolve(users[id]);
// }

exports.getUserWithId = getUserWithId;


/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = (user) => {
   return pool
    .query(`INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *;`, [user.name, user.email, user.password] )
    .then((result) => {
      return result.rows[0].id;
    })
    .catch((err) => {
      console.log(err.message);
    });
}

// const addUser =  function(user) {
//   const userId = Object.keys(users).length + 1;
//   user.id = userId;
//   users[userId] = user;
//   return Promise.resolve(user);
// }
exports.addUser = addUser;

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */

const getAllReservations = (guest_id, limit = 10) => {
  return pool
    .query(`SELECT reservations.id, properties.*, reservations.start_date, avg(rating) as average_rating
    FROM reservations
    JOIN properties ON reservations.property_id = properties.id
    JOIN property_reviews ON properties.id = property_reviews.property_id
    WHERE reservations.guest_id = $1
    GROUP BY properties.id, reservations.id
    ORDER BY reservations.start_date
    LIMIT $2;`, [guest_id, limit])
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.log(err.message);
    })
}

// const getAllReservations = function(guest_id, limit = 10) {
//   return getAllProperties(null, 2);
// }
exports.getAllReservations = getAllReservations;

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
// const getAllProperties = function(options, limit = 10) {
//   const limitedProperties = {};
//   for (let i = 1; i <= limit; i++) {
//     limitedProperties[i] = properties[i];
//   }
//   return Promise.resolve(limitedProperties);
// }

const getAllProperties = function (options, limit = 10) {
  // 1
  const queryParams = [];
  // 2
  let queryString = `
  SELECT properties.*, avg(property_reviews.rating) as average_rating
  FROM properties
  JOIN property_reviews ON properties.id = property_id
  `;

  //min/max cost per night query
  if (options.minimum_price_per_night && options.maximum_price_per_night) {
    queryParams.push(`${options.minimum_price_per_night*100}`);
    queryString += `WHERE properties.cost_per_night >= $${queryParams.length}`
    queryParams.push(`${options.maximum_price_per_night*100}`);
    queryString += `AND properties.cost_per_night <= $${queryParams.length}`
  }
  if (options.minimum_price_per_night && !options.maximum_price_per_night) {
    queryParams.push(`${options.minimum_price_per_night*100}`)
    queryString += `WHERE properties.cost_per_night >= $${queryParams.length}`
  }
  if (options.maximum_price_per_night && !options.minimum_price_per_night) {
    queryParams.push(`${options.maximum_price_per_night*100}`)
    queryString += `WHERE properties.cost_per_night <= $${queryParams.length}`
  }
  // 3 city query
  if (queryParams.length > 1 && options.city) {
    queryParams.push(`%${options.city}%`);
    queryString += `AND city LIKE $${queryParams.length} `;
  }
  if (queryParams.length === 0 && options.city) {
    queryParams.push(`%${options.city}%`);
    queryString += `WHERE city LIKE $${queryParams.length} `;
  }
  //properties owner_id query
  if (queryParams.length > 1 && options.owner_id) {
    queryParams.push(`${options.owner_id}`);
    queryString += `AND properties.owner_id = $${queryParams.length}`;
  }
  if (queryParams.length === 0 && options.owner_id) {
    queryParams.push(`${options.owner_id}`);
    queryString += `WHERE properties.owner_id = $${queryParams.length}`;
  }
  //min rating query
  if (queryParams.length > 1 && options.minimum_rating) {
    queryParams.push(`${options.minimum_rating}`);
    queryString += `AND property_reviews.rating >= $${queryParams.length}`;
  }
  if (queryParams.length === 0 && options.minimum_rating) {
    queryParams.push(`${options.minimum_rating}`);
    queryString += `WHERE property_reviews.rating >= $${queryParams.length}`;
  }

  // 4
  queryParams.push(limit);
  queryString += `
  GROUP BY properties.id
  ORDER BY cost_per_night
  LIMIT $${queryParams.length};
  `;

  // 5
  console.log("queryString:", queryString, "queryParams:", queryParams);

  // 6
  return pool
  .query(queryString, queryParams)
  .then((res) => res.rows);
};

exports.getAllProperties = getAllProperties;


/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function(property) {
  const propertyId = Object.keys(properties).length + 1;
  property.id = propertyId;
  properties[propertyId] = property;
  return Promise.resolve(property);
}
exports.addProperty = addProperty;
