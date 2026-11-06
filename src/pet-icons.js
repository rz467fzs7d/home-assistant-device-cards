import tabby from './assets/pet-tabby.svg';
import calico from './assets/pet-calico.svg';

const iconData = svg => {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return { path: document.querySelector('path').getAttribute('d'), viewBox: document.documentElement.getAttribute('viewBox') };
};
const icons = { 'cat-tabby': iconData(tabby), 'cat-calico': iconData(calico) };
window.customIcons = window.customIcons || {};
window.customIcons.hadc = {
  getIcon: async name => icons[name] || { path: '', viewBox: '0 0 24 24' },
  getIconList: async () => [
    { name: 'cat-tabby', keywords: ['cat', 'tabby', '\u72f8\u82b1'] },
    { name: 'cat-calico', keywords: ['cat', 'calico', '\u4e09\u82b1'] },
  ],
};
