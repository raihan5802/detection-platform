-- optional
-- Insert a test user (password: testpassword)
INSERT INTO users (id, username, email, password)
VALUES ('test123', 'testuser', 'test@example.com', 'testpassword')
ON CONFLICT (id) DO NOTHING;
