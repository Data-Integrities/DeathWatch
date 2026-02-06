// One-time script to insert 90 test queries from real obituary data
// Source: echovita.com February 2026 obituaries
// These are from independent/funeral home sources (not Legacy.com)

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('./pool');

// Real obituary data from echovita.com - Feb 3-5, 2026
// Format: [firstName, middleName, lastName, actualAge, city, state]
const testData = [
  // Ohio (24)
  ['Esther', 'Irene', 'Friend', 81, 'Akron', 'OH'],
  ['Cheryl', 'L.', 'House', 72, 'Orrville', 'OH'],
  ['Dale', 'L.', 'Tope', 84, 'Rittman', 'OH'],
  ['Stevan', null, 'Zivanovic', 52, 'Dayton', 'OH'],
  ['Thelma', 'P.', 'Yeager', 81, 'Ashville', 'OH'],
  ['Andrew', null, 'Harley', 67, 'Carey', 'OH'],
  ['Keith', 'W.', 'Bostick', 66, 'Dayton', 'OH'],
  ['Rosemary', null, 'Lombard', 87, 'Dayton', 'OH'],
  ['Betty', 'L.', 'Mains', 104, 'Dayton', 'OH'],
  ['Rita', null, 'Watson', 96, 'Columbus', 'OH'],
  ['Barbara', 'Jayne', 'Summers', 87, 'Dayton', 'OH'],
  ['Richard', 'J', 'Mittendorf', 90, 'Berlin Heights', 'OH'],

  // Oklahoma (12)
  ['Leland', 'A.', 'Ross', 87, 'Woodward', 'OK'],
  ['Rodney', 'Alan', 'Boyd', 54, 'Mustang', 'OK'],
  ['Lyndell', null, 'Cox', 70, 'Marietta', 'OK'],
  ['Tracy', null, 'Daniels', 61, 'Ardmore', 'OK'],
  ['Rhonda', 'Jean', 'Boomershine', 69, 'Tulsa', 'OK'],
  ['Nancy', 'Jo', 'Reedy', 86, 'Agra', 'OK'],
  ['Linda', 'Gaye', 'Holmes', 63, 'Tulsa', 'OK'],
  ['Patsy', 'Louise', 'Romer', 90, 'Tulsa', 'OK'],
  ['Nellie', 'J', 'Ardoin', 91, 'Lawton', 'OK'],
  ['Danita', 'Linn', 'Edwards', 68, 'Hoyt', 'OK'],
  ['Constance', 'Mae', 'Dice', 83, 'Lawton', 'OK'],
  ['John', 'Marion', 'Smart', 77, 'Duncan', 'OK'],

  // Virginia (12)
  ['Margaret', 'R.', 'Osborne', 79, 'Sterling', 'VA'],
  ['Anthony', null, 'Greene', 75, 'South Boston', 'VA'],
  ['John', null, 'Paunovich', 71, 'Danville', 'VA'],
  ['Glenda', 'Irby', 'Richardson', 76, 'Danville', 'VA'],
  ['Cecil', 'Ezekiel', 'Bridgeforth', 77, 'Danville', 'VA'],
  ['Norma', 'C.', 'Armstrong', 95, 'Falls Church', 'VA'],
  ['Charles', 'Marion', 'Hoover', 78, 'South Boston', 'VA'],
  ['Kyle', 'Anthony', 'Mayberry', 58, 'Lynchburg', 'VA'],
  ['Cynthia', null, 'Major', 71, 'Yorktown', 'VA'],
  ['Eva', 'Watson', 'Smythers', 93, 'Galax', 'VA'],
  ['Charles', 'Douglas', 'Poindexter', 83, 'Glade Hill', 'VA'],
  ['Janet', 'Boyd', 'Clark', 81, 'Lebanon', 'VA'],

  // New Jersey (12)
  ['Loretta', 'Mary', 'Bodtmann', 78, 'Wayne', 'NJ'],
  ['Anna', null, 'Fasciano', 91, 'North Bergen', 'NJ'],
  ['Helen', null, 'Hanson', 76, 'Florham Park', 'NJ'],
  ['Steven', 'W.', 'Henry', 66, 'Collings Lakes', 'NJ'],
  ['Michael', 'Philip', 'Abramek', 83, 'Atco', 'NJ'],
  ['Mary', 'E.', 'Dayback', 95, 'Keyport', 'NJ'],
  ['Lannie', 'M.', 'Silver', 76, 'Trenton', 'NJ'],
  ['Terry', 'L.', 'Stolfi', 71, 'Whippany', 'NJ'],
  ['John', 'G.', 'Sullivan', 70, 'Villas', 'NJ'],
  ['Gisela', null, 'Trimarchi', 90, 'Sparta', 'NJ'],
  ['Ramona', null, 'Green', 97, 'Palisades Park', 'NJ'],
  ['Lewis', 'R', 'Maldonado', 69, 'Toms River', 'NJ'],

  // New York (12)
  ['Velvet', null, 'Bello', 63, 'Brooklyn', 'NY'],
  ['Kathleen', null, 'Clarke', 79, 'Brooklyn', 'NY'],
  ['George', null, 'Jones', 90, 'Brooklyn', 'NY'],
  ['David', null, 'Johnson', 66, 'Massena', 'NY'],
  ['Elaine', null, 'Thomas', 84, 'Brooklyn', 'NY'],
  ['Brian', 'J', 'Wood', 60, 'Potsdam', 'NY'],
  ['Geraldine', null, 'Patterson', 88, 'Brooklyn', 'NY'],
  ['Fannie', null, 'Marcus', 86, 'Brooklyn', 'NY'],
  ['Paul', null, 'Thompson', 69, 'Southampton', 'NY'],
  ['Yi', 'M.', 'Huang', 82, 'Goshen', 'NY'],
  ['Margaret', 'M', 'Tindall', 85, 'Staten Island', 'NY'],
  ['Gerald', 'A.', 'Warren', 84, 'West Seneca', 'NY'],

  // Texas (12)
  ['Wilbert', null, 'Hawkins', 90, 'Waco', 'TX'],
  ['Leonardo', 'Joseph', 'Cadena', 67, 'Austin', 'TX'],
  ['Gary', 'Leon', 'Raschke', 71, 'Vernon', 'TX'],
  ['Walter', 'Douglas', 'Clare', 78, 'San Antonio', 'TX'],
  ['Mary', 'Lou', 'Randall', 90, 'San Antonio', 'TX'],
  ['Bernabe', 'E.', 'Morales', 82, 'San Antonio', 'TX'],
  ['Lexy', null, 'McBride', 89, 'San Antonio', 'TX'],
  ['Bertha', 'M.', 'Von Buettner', 94, 'San Antonio', 'TX'],
  ['Thomas', 'Michael', 'Kirby', 79, 'San Antonio', 'TX'],
  ['Elaine', 'Karenmae', 'Rabb', 87, 'Gatesville', 'TX'],
  ['Nelda', 'Ann', 'Whatley', 77, 'Bruceville', 'TX'],
  ['Sandra', 'Jayne', 'Carlyon', 68, 'San Antonio', 'TX'],

  // California (6)
  ['Michael', 'Scott', 'Braithwaite', 61, 'Ridgecrest', 'CA'],
  ['Rodney', null, 'Nahama', 93, 'Bakersfield', 'CA'],
  ['Carroll', 'Dean', 'Buck', 88, 'Lake Isabella', 'CA'],
  ['Juanita', null, 'Brumfield', 84, 'Santa Rosa', 'CA'],
  ['Joseph', 'Earl', 'Allekna', 97, 'Santa Rosa', 'CA'],
  ['Gloria', 'Barbara', 'Bouler', 94, 'Santa Rosa', 'CA'],

  // Florida (6)
  ['Paul', 'Melvin', 'Romel', 66, 'Pensacola', 'FL'],
  ['Katrine', null, 'Jackson', 79, 'Naples', 'FL'],
  ['Betty', 'Keith', 'Bayko', 93, 'Orlando', 'FL'],
  ['Timothy', 'R.', 'Bray', 68, 'Palm Bay', 'FL'],
  ['William', 'Robert', 'Drahl', 76, 'Orlando', 'FL'],
  ['Mark', 'S.', 'Higgins', 69, 'Parrish', 'FL'],

  // Missouri (6) - replacing some to reach 90 exactly
  ['Anne', null, 'Benda', 91, 'Wentzville', 'MO'],
  ['Judith', 'L.', 'Mueller', 82, 'Saint Louis', 'MO'],
  ['Mary', null, 'Bradshaw', 66, 'Leslie', 'MO'],
  ['Stephanie', null, 'Ronsick', 84, 'Foristell', 'MO'],
  ['Ronald', null, 'Fussner', 87, 'Osage Beach', 'MO'],
  ['Laura', null, 'Easley', 84, 'Kansas City', 'MO'],
];

async function run() {
  console.log(`Inserting ${testData.length} test queries...`);

  let inserted = 0;
  for (const [firstName, middleName, lastName, actualAge, city, state] of testData) {
    try {
      await pool.query(
        `INSERT INTO user_query (first_name, middle_name, last_name, actual_age, city, state)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [firstName, middleName, lastName, actualAge, city, state]
      );
      inserted++;
    } catch (err) {
      console.error(`Error inserting ${firstName} ${lastName}: ${err.message}`);
    }
  }

  console.log(`Inserted ${inserted} of ${testData.length} test queries.`);

  // Show total count
  const { rows } = await pool.query('SELECT COUNT(*) AS count FROM user_query');
  console.log(`Total queries in database: ${rows[0].count}`);

  await pool.end();
}

run().catch(err => {
  console.error(err);
  pool.end();
  process.exit(1);
});
