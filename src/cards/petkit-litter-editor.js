const fields = [
  ['entity', 'Device status', 'sensor'], ['stats_entity', 'Today visits statistics', 'sensor'],
  ['calendar_entity', 'History calendar', 'calendar'],
  ['state_entity', 'Operating state', 'sensor'], ['occupancy_entity', 'Occupancy', 'binary_sensor'], ['fault_entity', 'Fault', 'sensor'],
  ['litter_entity', 'Litter level', 'sensor'], ['weight_entity', 'Litter weight', 'sensor'], ['waste_entity', 'Waste bin full', 'binary_sensor'],
  ['scoop_entity', 'Clean', 'button'], ['dump_entity', 'Empty litter', 'button'], ['level_entity', 'Level litter', 'button'],
  ['pause_entity', 'Pause', 'button'], ['continue_entity', 'Continue', 'button'],
  ['auto_clean_entity', 'Automatic cleaning', 'switch'], ['child_lock_entity', 'Child lock', 'switch'], ['do_not_disturb_entity', 'Do not disturb', 'switch']
];
class PetkitLitterEditor extends HTMLElement {
  setConfig(config) { this.config = { ...config }; if (!this.shadowRoot) this.attachShadow({ mode: 'open' }); this.render(); }
  set hass(value) {
    this._hass = value;
    const signature = JSON.stringify(this.pets());
    if (this.shadowRoot && signature !== this.petSignature) { this.petSignature = signature; this.render(); }
    this.shadowRoot?.querySelectorAll('ha-selector').forEach(node => { node.hass = value; });
  }
  pets() {
    const rows = this._hass?.states?.[this.config?.stats_entity]?.attributes?.pets;
    return Array.isArray(rows) ? rows.filter(row => row && typeof row.id === 'string').map(row => ({ id: row.id, name: row.name || row.id })) : [];
  }
  change(key, value) {
    this.config = { ...this.config, [key]: value || undefined };
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this.config }, bubbles: true, composed: true }));
  }
  render() {
    this.shadowRoot.innerHTML = '<style>:host{display:block}label,ha-selector{display:block;margin-bottom:16px}input{display:block;width:100%;padding:10px;box-sizing:border-box;font:inherit}details{margin-top:12px}summary{margin-bottom:16px;cursor:pointer}</style><label>Name<input></label><div class="primary"></div><details><summary>Entity bindings</summary></details>';
    const input = this.shadowRoot.querySelector('input'); input.value = this.config.name || '';
    input.onchange = () => this.change('name', input.value);
    for (const [key, label, domain] of fields) {
      const node = document.createElement('ha-selector'); node.hass = this._hass; node.selector = { entity: { domain: [domain] } }; node.label = label; node.value = this.config[key];
      node.addEventListener('value-changed', event => { event.stopPropagation(); this.change(key, event.detail.value); });
      this.shadowRoot.querySelector(['entity', 'stats_entity'].includes(key) ? '.primary' : 'details').append(node);
    }
    if (this.pets().length) {
      const section = document.createElement('details'); section.innerHTML = '<summary>Pet icons</summary>';
      for (const pet of this.pets()) {
        const node = document.createElement('ha-selector'); node.hass = this._hass; node.selector = { icon: {} };
        node.label = pet.name; node.dataset.petId = pet.id; node.value = this.config.pet_icons?.[pet.id] || 'mdi:cat';
        node.addEventListener('value-changed', event => {
          event.stopPropagation();
          const icons = { ...this.config.pet_icons };
          if (event.detail.value) icons[pet.id] = event.detail.value; else delete icons[pet.id];
          this.change('pet_icons', icons);
        });
        section.append(node);
      }
      this.shadowRoot.append(section);
    }
  }
}
if (!customElements.get('petkit-litter-card-editor')) customElements.define('petkit-litter-card-editor', PetkitLitterEditor);
