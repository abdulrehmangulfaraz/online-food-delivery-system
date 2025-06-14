const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// Get all menu items (public)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM menu');
    res.json(rows);
  } catch (error) {
    console.error('Menu Load Error:', error);
    res.status(500).json({ message: 'Server error while loading menu' });
  }
});

// Add new item (admin only)
router.post('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admins only' });
  }

  const { name, price, emoji } = req.body;
  if (!name || !price || !emoji) {
    return res.status(400).json({ message: 'Name, price, and emoji are required' });
  }

  try {
    await db.query('INSERT INTO menu (name, price, emoji) VALUES (?, ?, ?)', [name, price, emoji]);
    res.status(201).json({ message: 'Item added' });
  } catch (error) {
    console.error('Add Menu Error:', error);
    res.status(500).json({ message: 'Error adding item' });
  }
});

// Delete item (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admins only' });
  }

  try {
    await db.query('DELETE FROM menu WHERE id = ?', [req.params.id]);
    res.json({ message: 'Item deleted' });
  } catch (error) {
    console.error('Delete Menu Error:', error);
    res.status(500).json({ message: 'Error deleting item' });
  }
});

module.exports = router;