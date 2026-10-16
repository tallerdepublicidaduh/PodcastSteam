/* Spatial navigation follows the visible layout rather than the DOM tab order. */
window.controllerNavigation = {
  move(direction, root = document) {
    const controls = [...root.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')]
      .filter(node => node.getClientRects().length && !node.closest('[inert]'));
    if (!controls.length) return;
    const active = document.activeElement;
    if (!controls.includes(active)) {
      (controls.find(node => node.matches('[data-view="all"]')) || controls[0]).focus();
      return;
    }
    const bounds = active.getBoundingClientRect();
    const origin = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const vector = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[direction];
    let target, best = Infinity;
    for (const node of controls) {
      if (node === active) continue;
      const rect = node.getBoundingClientRect();
      const x = rect.x + rect.width / 2 - origin.x;
      const y = rect.y + rect.height / 2 - origin.y;
      const distance = x * vector[0] + y * vector[1];
      if (distance <= 8) continue;
      const offset = Math.abs(x * vector[1] + y * vector[0]);
      const score = distance + offset * 2.5 + (offset > distance ? 500 : 0);
      if (score < best) { best = score; target = node; }
    }
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }
  },
  adjust(node, direction) {
    if (node instanceof HTMLInputElement && node.type === 'range' && !node.disabled) {
      const step = node.id === 'volume' ? 0.05 : 5;
      const value = Math.max(Number(node.min), Math.min(Number(node.max), Number(node.value) + step * direction));
      node.value = value.toFixed(2);
      node.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    if (node instanceof HTMLSelectElement && !node.disabled) {
      node.selectedIndex = Math.max(0, Math.min(node.options.length - 1, node.selectedIndex + direction));
      node.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }
};
