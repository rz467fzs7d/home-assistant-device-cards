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
  set hass(value) { this._hass = value; this.shadowRoot?.querySelectorAll('ha-selector').forEach(node => { node.hass = value; }); }
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
  }
}
if (!customElements.get('petkit-litter-card-editor')) customElements.define('petkit-litter-card-editor', PetkitLitterEditor);
