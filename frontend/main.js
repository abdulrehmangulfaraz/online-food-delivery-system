// Common functions for all pages
function logout() {
  localStorage.removeItem('token');
  window.location.href = '../login.html';
}

function getUser() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch (error) {
    console.error('Token parsing error:', error);
    return null;
  }
}

function protect(roleRequired) {
  const user = getUser();
  
  if (!user) {
    alert('Please login first');
    window.location.href = '../login.html';
    return;
  }

  if (user.role !== roleRequired) {
    alert(`Access Denied - ${roleRequired} only`);
    window.location.href = user.role === 'admin' 
      ? '../admin/dashboard.html' 
      : '../customer/menu.html';
    return;
  }
}

// Cart management functions
let cart = JSON.parse(localStorage.getItem('cart')) || [];

function addToCart(item) {
  cart.push(item);
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
}

function removeFromCart(itemId) {
  cart = cart.filter(item => item.id !== itemId);
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const countElements = document.querySelectorAll('.cart-count');
  countElements.forEach(el => {
    el.textContent = cart.length;
  });
}

// Initialize cart count on pages that need it
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.cart-count')) {
    updateCartCount();
  }
});