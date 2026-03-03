export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageData, mimeType, month, season, plantName } = req.body;
    if (!imageData && !plantName) return res.status(400).json({ error: 'imageData eller plantName saknas' });

    const safeMime = ['image/jpeg','image/png','image/gif','image/webp'].includes(mimeType) ? mimeType : 'image/jpeg';

    const prompt = 'Det ar ' + season + ' (' + month + ') i Sverige. '
      + 'Svara ENDAST med JSON utan kodblock: '
      + '{"commonName":"KORREKT svenskt namn (ej direktoversatt fran engelska, t.ex. Fredens lilja heter Fredskalla, Peace rose heter Fredsros - anvand det etablerade svenska namnet)",'
      + '"scientificName":"latinskt namn",'
      + '"wateringFreq":"t.ex. Var 3-4 dag, eller tomt strang om okant",'
      + '"watering":"kort vattningsinstruktion, eller tomt om okant",'
      + '"sunlight":"solbehov, eller tomt om okant",'
      + '"isOutdoor":true eller false,'
      + '"planting":"planteringsrad for Sverige, eller tomt om ej relevant",'
      + '"plantingMonths":"basta manader t.ex. Maj-juni, eller tomt om ej relevant",'
      + '"fertilizing":"nar och hur godsla i Sverige, eller tomt om ej relevant",'
      + '"pruning":"nar och hur klippa, eller tomt om ej relevant",'
      + '"currentAdvice":"rad for vaxten nu i ' + month + ', eller tomt om inget specifikt",'
      + '"tip":"unikt proffstips, eller tomt om inget specifikt",'
      + '"funFact":"en kort engagerande och rolig fakta om just denna vaxtart, t.ex. om dess historia, egenskaper, rekord eller nyfiken egenskap. Max 2 meningar pa svenska."} '
      + 'VIKTIGT: Anvand alltid det officiella svenska trivialnamnet, inte en direktoversattning. '
      + 'Lamna faltet som tomt strang om du inte har tillracklig information. '
      + 'For utomhusvaxter/buskar: ange fertilizing och pruning med exakta manader. '
      + 'Sista frost Sverige: maj sodra, juni norra.';

    const messages = plantName
      ? [{ role: 'user', content: 'Ge skotselinformation om vaxten: ' + plantName + '. ' + prompt }]
      : [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: safeMime, data: imageData } },
          { type: 'text', text: 'Identifiera denna vaxt. ' + prompt }
        ]}];

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1200, messages })
    });

    const data = await apiRes.json();
    if (!apiRes.ok) throw new Error(data.error?.message || JSON.stringify(data));

    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock) throw new Error('Inget textsvar fran API');

    const raw = textBlock.text;
    const i = raw.indexOf('{');
    const j = raw.lastIndexOf('}');
    if (i === -1) throw new Error('Inget JSON i svaret');

    const parsed = JSON.parse(raw.slice(i, j + 1));
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
