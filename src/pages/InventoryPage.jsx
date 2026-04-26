export default function InventoryPage({ inventoryItems }) {
  return (
    <section className="page-grid">
      <div className="hero-card hero-card--inventory">
        <p className="eyebrow">Inventory</p>
        <h2>Live stock snapshot</h2>
        <p>Counts stay visible even when users capture data later from paper notes.</p>
      </div>
      <div className="inventory-grid">
        {inventoryItems.map((item) => (
          <article key={item.id} className="inventory-card">
            <div className="inventory-card__topline">
              <strong>{item.name}</strong>
              <span className={`status-pill status-pill--${String(item.status).toLowerCase()}`}>{item.status}</span>
            </div>
            <p>
              <strong>{item.current_stock}</strong> {item.unit} on hand
            </p>
            <p>Reorder level: {item.reorder_level} {item.unit}</p>
            <p>Unit cost: KES {item.unit_cost_kes}</p>
            <p className="inventory-card__note">{item.raw_input_text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

