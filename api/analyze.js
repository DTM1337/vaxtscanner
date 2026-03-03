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
      + '{"commonName":"namn pa svenska","scientificName":"latinskt namn",'
      + '"wateringFreq":"t.ex. Var 3-4 dag","watering":"kort vattningsinstruktion",'
      + '"sunlight":"solbehov","isOutdoor":true,'
      + '"planting":"planteringsrad for Sverige","plantingMonths":"basta manader t.ex. Maj-juni",'
      + '"fertilizing":"nar och hur godsla i Sverige, tomt om ej relevant",'
      + '"pruning":"nar och hur klippa i Sverige, tomt om ej relevant",'
      + '"currentAdvice":"specifikt rad for vaxten nu i ' + month + ' i Sverige",'
      + '"tip":"unikt proffstips for arten"} '
      + 'For utomhusvaxter/buskar: alltid fertilizing och pruning med exakta manader. '
      + 'Sista frost Sverige: maj sodra, juni norra. '
      + 'For inomhusvaxter: pruning tomt om ej relevant.';

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
