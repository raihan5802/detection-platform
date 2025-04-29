const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Create a new DB connection pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'detection_platform',
    port: process.env.DB_PORT || 5432
});

// Function to set up the database
const setupDatabase = async () => {
    const client = await pool.connect();

    try {
        console.log('Setting up database...');

        // Begin transaction
        await client.query('BEGIN');

        // Read and execute the schema.sql file
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await client.query(schemaSql);

        console.log('Schema created successfully!');

        // Commit transaction
        await client.query('COMMIT');

        console.log('Database setup completed successfully!');
    } catch (error) {
        // Rollback transaction on error
        await client.query('ROLLBACK');
        console.error('Database setup failed:', error);
        throw error;
    } finally {
        // Release client back to pool
        client.release();
        await pool.end();
    }
};

// Only run setup if this file is executed directly
if (require.main === module) {
    setupDatabase();
}

module.exports = { setupDatabase, pool };