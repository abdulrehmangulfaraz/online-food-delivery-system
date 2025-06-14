const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/authMiddleware');


// Get billing info for an order
// Get billing info for an order (with item prices and order status)
router.get('/:id/billing', authMiddleware, async (req, res) => {
  const order_id = req.params.id;
  const user_id = req.user.id;

  try {
    // 1. Ensure user owns the order
    const [orders] = await db.query(
      'SELECT id, status, statusEmoji FROM orders WHERE id = ? AND user_id = ?',
      [order_id, user_id]
    );

    if (orders.length === 0) {
      return res.status(403).json({ message: 'Access denied to this order' });
    }

    const { status, statusEmoji } = orders[0];

    // 2. Fetch billing info
    const [billing] = await db.query(
      'SELECT subtotal, delivery_fee, total FROM billing WHERE order_id = ?',
      [order_id]
    );

    if (billing.length === 0) {
      return res.status(404).json({ message: 'Billing record not found' });
    }

    // 3. Fetch detailed item list
    const [items] = await db.query(
      `SELECT m.name, oi.quantity, oi.price AS unitPrice
       FROM order_items oi
       JOIN menu m ON oi.menu_id = m.id
       WHERE oi.order_id = ?`,
      [order_id]
    );

    const itemList = items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unitPrice),
      total: parseFloat((item.unitPrice * item.quantity).toFixed(2))
    }));

    // 4. Return full response
    res.json({
      status,
      statusEmoji,
      items: itemList,
      subtotal: billing[0].subtotal,
      deliveryFee: billing[0].delivery_fee,
      total: billing[0].total
    });
  } catch (error) {
    console.error('Error loading billing info:', error);
    res.status(500).json({ message: 'Server error loading billing info' });
  }
});


router.post('/checkout', authMiddleware, async (req, res) => {
    const user_id = req.user.id;
    const deliveryFee = 10.00;

    try {
        // 1. Get pending order
        const [orders] = await db.query(
            'SELECT id FROM orders WHERE user_id = ? AND status = ?',
            [user_id, 'Pending']
        );

        if (orders.length === 0) {
            return res.status(400).json({ message: 'No pending order to checkout' });
        }

        const order_id = orders[0].id;

        // 2. Get order items
        const [items] = await db.query(
            'SELECT quantity, price FROM order_items WHERE order_id = ?',
            [order_id]
        );

        if (items.length === 0) {
            return res.status(400).json({ message: 'Cart is empty. Cannot proceed to checkout.' });
        }

        // 3. Calculate subtotal
        let subtotal = 0;
        items.forEach(item => {
            subtotal += item.quantity * item.price;
        });

        const total = subtotal + deliveryFee;

        // 4. Get next billing ID manually
        const [billingIdResult] = await db.query('SELECT MAX(id) AS maxId FROM billing');
        const nextBillingId = (billingIdResult[0].maxId || 0) + 1;

        // 5. Insert billing record
        await db.query(
            'INSERT INTO billing (id, order_id, subtotal, delivery_fee, total) VALUES (?, ?, ?, ?, ?)',
            [nextBillingId, order_id, subtotal, deliveryFee, total]
        );

        // 6. Update order status
        await db.query(
            'UPDATE orders SET status = ?, statusEmoji = ? WHERE id = ?',
            ['Confirmed', '✅', order_id]
        );

        res.status(200).json({ message: 'Order confirmed', orderId: order_id });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ message: 'Server error during checkout' });
    }
});




// Get order history for the logged-in user
router.get('/history', authMiddleware, async (req, res) => {
    const user_id = req.user.id;
    try {
        const [orders] = await db.query(
            'SELECT id, status, statusEmoji, created_at AS updatedAt FROM orders WHERE user_id = ?',
            [user_id]
        );
        if (orders.length === 0) {
            return res.status(404).json({ message: 'No orders found' });
        }
        res.json(orders);
    } catch (error) {
        console.error('Error fetching order history:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add item to cart
router.post('/add-to-cart', authMiddleware, async (req, res) => {
    const { menuId, quantity, price } = req.body;
    const user_id = req.user.id;

    try {
        // 1. Check if user has a pending order
        const [existingOrder] = await db.query(
            'SELECT id FROM orders WHERE user_id = ? AND status = ?',
            [user_id, 'Pending']
        );

        let order_id;

        if (existingOrder.length === 0) {
            // 2. Get next order ID manually
            const [orderIdResult] = await db.query('SELECT MAX(id) AS maxId FROM orders');
            order_id = (orderIdResult[0].maxId || 0) + 1;

            await db.query(
                'INSERT INTO orders (id, user_id, status, statusEmoji) VALUES (?, ?, ?, ?)',
                [order_id, user_id, 'Pending', '🛒']
            );
        } else {
            order_id = existingOrder[0].id;
        }

        // 3. Verify menu item exists
        const [menuItem] = await db.query('SELECT id FROM menu WHERE id = ?', [menuId]);
        if (menuItem.length === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }

        // 4. Check if item already exists in the order
        const [existingItem] = await db.query(
            'SELECT id FROM order_items WHERE order_id = ? AND menu_id = ?',
            [order_id, menuId]
        );

        if (existingItem.length > 0) {
            // 5. Update quantity
            await db.query(
                'UPDATE order_items SET quantity = quantity + ? WHERE id = ?',
                [quantity, existingItem[0].id]
            );
        } else {
            // 6. Get next order_item ID manually
            const [itemIdResult] = await db.query('SELECT MAX(id) AS maxId FROM order_items');
            const nextItemId = (itemIdResult[0].maxId || 0) + 1;

            // 7. Insert new item manually
            await db.query(
                'INSERT INTO order_items (id, order_id, menu_id, quantity, price) VALUES (?, ?, ?, ?, ?)',
                [nextItemId, order_id, menuId, quantity, price]
            );
        }

        res.status(200).json({ message: 'Item added to cart' });
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ error: 'Server error' });
    }
});


// Track order status
router.get('/track/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;
    console.log('User ID:', user_id, 'Order ID:', id);
    try {
        const [orders] = await db.query(
            'SELECT id, status, statusEmoji, created_at AS updatedAt FROM orders WHERE id = ? AND user_id = ?',
            [id, user_id]
        );

        if (orders.length === 0) {
            return res.status(404).json({ message: 'Order not found or access denied' });
        }

        const order = orders[0];
        res.json(order);
    } catch (error) {
        console.error('Error tracking order:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update order status
router.put('/update/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { status, statusEmoji } = req.body;

    try {
        const [result] = await db.query(
            'UPDATE orders SET status = ?, statusEmoji = ? WHERE id = ?',
            [status, statusEmoji, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;