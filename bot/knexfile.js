require('dotenv').config();

module.exports = {
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'gymdb',
        port: process.env.DB_PORT || 3306
    },
    pool: { min: 0, max: 7 }
};
