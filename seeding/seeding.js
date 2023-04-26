const fs = require('fs');
const mysql = require('mysql');

//Creates Database Connection

async function seedDatabase() {
    const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'imagegallery',
    });

    const csvData = fs.readFileSync(`${__dirname}/comments.csv`, 'utf8');

    const rows = csvData.split('\n').slice(1).map((row) => {
        const [comment, user, image] = row.split(',');
        return { comment, user, image };
    });

    //Insert data into MySQL database

    for (const row of rows) {
        await conn.query('INSERT INTO comments (comment, user, image) VALUE (?, ?, ?)', [row.comment, row.user, row.image]);
    }

    console.log('Successfully inserted data into the database.');
    
    conn.end();
};

seedDatabase();