const EventEmitter = require('events');

// Simple in-memory bounded queue with intentional overflow risk
class BoundedQueue extends EventEmitter {
  constructor(maxSize = 1000) {
    super();
    this.maxSize = maxSize;
    this.queue = [];
    this.dropped = 0;
  }

  push(item) {
    if (this.queue.length >= this.maxSize) {
      this.dropped += 1;
      this.emit('overflow', { dropped: this.dropped });
      // Intentionally drop silently
      return false;
    }
    this.queue.push(item);
    this.emit('push', item);
    return true;
  }

  pop() {
    return this.queue.shift();
  }

  size() {
    return this.queue.length;
  }

  stats() {
    return { size: this.size(), dropped: this.dropped };
  }
}

module.exports = BoundedQueue;
