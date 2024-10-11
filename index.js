const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const connection = mysql.createConnection(process.env.DATABASE_URL);

// Setup for uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Specify folder to save the uploaded images
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname); // Set filename
    }
});
const upload = multer({ storage: storage });

app.get('/', (req, res) => {
    res.send('Hello world!!');
});

// User Registration Route (no JWT)
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    connection.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error', err });

        if (results.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = { username, email, password: hashedPassword };

        connection.query('INSERT INTO users SET ?', user, (err, result) => {
            if (err) return res.status(500).json({ message: 'Database error', err });

            res.status(201).json({ message: 'User registered successfully' });
        });
    });
});

// User Login Route (no JWT)
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    connection.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error', err });

        if (results.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        res.json({ message: 'Logged in successfully' });
    });
});

// Route to create a new post (no token required)
app.post('/post', (req, res) => {
    const { caption, imageUrl } = req.body;
    const post = { user_id: 1, caption, image_url: imageUrl }; // Default user_id (change if needed)

    connection.query('INSERT INTO posts SET ?', post, (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', err });
        }
        res.status(201).json({ message: 'Post created successfully', postId: result.insertId });
    });
});

// Route to retrieve all posts
app.get('/posts', (req, res) => {
    connection.query('SELECT * FROM posts ORDER BY created_at DESC', (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', err });
        }
        res.json(results);
    });
});

// Route to retrieve posts by a specific user
app.get('/posts/:userId', (req, res) => {
    const userId = req.params.userId;

    connection.query('SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', err });
        }
        res.json(results);
    });
});

// Update Post (no token required)
app.put('/post/:id', (req, res) => {
    const postId = req.params.id;
    const { caption, imageUrl } = req.body;

    connection.query('UPDATE posts SET caption = ?, image_url = ? WHERE id = ?', 
        [caption, imageUrl, postId], (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Database error', err });
            }
            if (results.affectedRows === 0) {
                return res.status(404).json({ message: 'Post not found' });
            }
            res.json({ message: 'Post updated successfully' });
        });
});

// Delete Post (no token required)
app.delete('/post/:id', (req, res) => {
    const postId = req.params.id;

    connection.query('DELETE FROM posts WHERE id = ?', [postId], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', err });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: 'Post not found' });
        }
        res.json({ message: 'Post deleted successfully' });
    });
});

// Add Comment (no token required)
app.post('/post/:id/comment', (req, res) => {
    const postId = req.params.id;
    const { content } = req.body;

    connection.query('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)', 
        [postId, 1, content], (err, result) => { // Use default user_id for now
            if (err) {
                return res.status(500).json({ message: 'Database error', err });
            }
            res.status(201).json({ message: 'Comment added successfully', commentId: result.insertId });
        });
});

// Like Post (no token required)
app.post('/post/:id/like', (req, res) => {
    const postId = req.params.id;

    connection.query('SELECT * FROM likes WHERE post_id = ? AND user_id = ?', [postId, 1], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', err });
        }
        if (results.length > 0) {
            return res.status(400).json({ message: 'Post already liked' });
        }

        connection.query('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [postId, 1], (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Database error', err });
            }
            res.status(201).json({ message: 'Post liked successfully', likeId: result.insertId });
        });
    });
});

// Upload Image (no token required)
app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    res.json({ message: 'File uploaded successfully', filePath: req.file.path });
});


app.post('/follow/:userId', (req, res) => {
    const followerId = req.user; // This should come from the decoded JWT token
    const followingId = req.params.userId;

    // Insert a record in the followers table
    connection.query('INSERT INTO followers (follower_id, following_id) VALUES (?, ?)', 
        [followerId, followingId], (err, result) => {
            if (err) return res.status(500).json({ message: 'Database error', err });
            res.status(200).json({ message: 'Followed user successfully' });
        });
});

app.post('/unfollow/:userId', (req, res) => {
    const followerId = req.user;
    const followingId = req.params.userId;

    // Delete a record from the followers table
    connection.query('DELETE FROM followers WHERE follower_id = ? AND following_id = ?', 
        [followerId, followingId], (err, result) => {
            if (err) return res.status(500).json({ message: 'Database error', err });
            res.status(200).json({ message: 'Unfollowed user successfully' });
        });
});


app.post('/message/:receiverId', (req, res) => {
    const senderId = req.user;
    const receiverId = req.params.receiverId;
    const { message } = req.body;

    connection.query('INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)', 
        [senderId, receiverId, message], (err, result) => {
            if (err) return res.status(500).json({ message: 'Database error', err });
            res.status(200).json({ message: 'Message sent successfully' });
        });
});

// Get messages between two users
app.get('/messages/:userId', (req, res) => {
    const userId = req.user;
    const otherUserId = req.params.userId;

    connection.query(
        'SELECT * FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)', 
        [userId, otherUserId, otherUserId, userId], (err, results) => {
            if (err) return res.status(500).json({ message: 'Database error', err });
            res.json(results);
        }
    );
});

app.get('/search/users', (req, res) => {
    const searchTerm = req.query.q;

    connection.query('SELECT * FROM users WHERE username LIKE ?', [`%${searchTerm}%`], (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error', err });
        res.json(results);
    });
});

app.get('/search/posts', (req, res) => {
    const searchTerm = req.query.q;

    connection.query('SELECT * FROM posts WHERE caption LIKE ?', [`%${searchTerm}%`], (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error', err });
        res.json(results);
    });
});

app.get('/user/:id/profile', (req, res) => {
    const userId = req.params.id;

    // Get user info, posts, followers, and following
    connection.query(
        `SELECT u.id, u.username, u.email, 
                (SELECT COUNT(*) FROM followers WHERE following_id = u.id) AS followers_count, 
                (SELECT COUNT(*) FROM followers WHERE follower_id = u.id) AS following_count 
         FROM users u WHERE u.id = ?`, 
        [userId], (err, userResults) => {
            if (err) return res.status(500).json({ message: 'Database error', err });

            connection.query('SELECT * FROM posts WHERE user_id = ?', [userId], (err, postResults) => {
                if (err) return res.status(500).json({ message: 'Database error', err });

                res.json({
                    user: userResults[0],
                    posts: postResults
                });
            });
        });
});



app.listen(process.env.PORT || 3000, () => {
    console.log('CORS-enabled web server listening on port 3000');
});
