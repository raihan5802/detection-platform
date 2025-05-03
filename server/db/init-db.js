const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

/**
 * Initialize the database by creating the schema
 */
async function initializeDatabase() {
    const client = await pool.connect();

    try {
        console.log('Initializing database...');

        // Read the schema SQL file
        const schemaFilePath = path.join(__dirname, 'schema.sql');

        if (!fs.existsSync(schemaFilePath)) {
            console.error('Schema file not found:', schemaFilePath);
            process.exit(1);
        }

        const schemaSql = fs.readFileSync(schemaFilePath, 'utf8');

        // Execute the schema SQL to create the database structure
        console.log('Creating database schema...');
        await client.query(schemaSql);

        // Create a default admin user if needed
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'adminpassword'; // In production, use a secure password
        const adminUsername = process.env.ADMIN_USERNAME || 'Administrator';

        // Check if we should create the default admin user
        const createAdmin = process.env.CREATE_ADMIN_USER === 'true';

        if (createAdmin) {
            // Check if admin user already exists
            const userResult = await client.query('SELECT * FROM users WHERE email = $1', [adminEmail]);

            if (userResult.rows.length === 0) {
                console.log('Creating default admin user...');

                // In a real application, you would hash the password here
                await client.query(
                    'INSERT INTO users (username, email, password) VALUES ($1, $2, $3)',
                    [adminUsername, adminEmail, adminPassword]
                );

                console.log('Default admin user created');
            } else {
                console.log('Admin user already exists, skipping creation');
            }
        }

        console.log('Database initialization completed successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    } finally {
        client.release();
    }
}

// Run the initialization process
initializeDatabase()
    .then(() => {
        console.log('Database setup complete');
        process.exit(0);
    })
    .catch(err => {
        console.error('Database setup failed:', err);
        process.exit(1);
    });