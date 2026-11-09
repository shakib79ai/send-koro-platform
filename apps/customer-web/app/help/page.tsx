export const metadata = { title: 'Help & refunds' };

export default function HelpPage() {
  return (
    <div className="container" style={{ paddingTop: 24, maxWidth: 760 }}>
      <h1 style={{ fontSize: 30 }}>Help</h1>
      <div className="card pad stack" style={{ marginTop: 16 }}>
        <h3>Contact us</h3>
        <p className="small">Email <a className="link" href="mailto:info@shlglobal.biz">info@shlglobal.biz</a> or call <a className="link" href="tel:+19176248233">+1 917-624-8233</a>. Include your order code (it starts with SK-).</p>
      </div>
      <div className="card pad stack" style={{ marginTop: 16 }} id="refunds">
        <h3>Refunds</h3>
        <p className="small">If the restaurant doesn’t accept your order within 5 minutes, or declines it, your card is never charged — the hold is released automatically. For missing or wrong items, contact us with your order code and we’ll refund the affected items.</p>
      </div>
      <div className="card pad stack" style={{ marginTop: 16 }}>
        <h3>How our prices work</h3>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Restaurants pay Send Koro a flat monthly plan — <b>$0 commission on your food</b>.</li>
          <li>The <b>delivery fee</b> is what the delivery costs. Many restaurants pay some or all of it for you.</li>
          <li><b>Sales tax</b> is set and paid by the restaurant.</li>
          <li><b>100% of your tip</b> goes to your courier. We never charge you card fees.</li>
        </ul>
      </div>
      <div className="card pad stack" style={{ marginTop: 16 }} id="drive">
        <h3>Drive with us</h3>
        <p className="small">Upfront pay you see before you accept, 100% of tips, and NYC minimum pay guaranteed. Download the Send Koro Driver app.</p>
      </div>
      <div className="card pad stack" style={{ marginTop: 16 }} id="terms"><h3>Terms</h3><p className="small muted">Terms of service — to be published before launch.</p></div>
      <div className="card pad stack" style={{ marginTop: 16 }} id="privacy"><h3>Privacy</h3><p className="small muted">Privacy policy — to be published before launch.</p></div>
    </div>
  );
}
