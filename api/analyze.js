export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageData, mimeType, month, season } = req.body;
    if (!imageData) return res.status(400).json({ error: 'imageData saknas' });

    const safeMime = ['image/jpeg','image/png','image/gif','image/webp'].includes(mimeType)
      ? mimeType : 'image/jpeg';

    const prompt = 'Identifiera denna vaxt. Det ar ' + season + ' (' + month + ') i Sverige. '
      + 'Svara ENDAST med JSON utan kodblock: '
      + '{"commonName":"namn pa svenska","scientificName":"latinskt namn",'
      + '"wateringFreq":"t.ex. Var 3-4 dag","watering":"kort vattningsinstruktion",'
      + '"sunlight":"solbehov","isOutdoor":true eller false,'
      + '"planting":"planteringsrad for Sverige och nuvarande arstid",'
      + '"plantingMonths":"basta manaderna i Sverige t.ex. Maj-juni efter sista frost",'
      + '"fertilizing":"nar och hur man godslar denna vaxt i Sverige, t.ex. Godsla var 2:e vecka maj-aug med allgodsel. Tomt om ej relevant.",'
      + '"pruning":"nar och hur man klipper eller trimmar vaxten i Sverige, t.ex. Klipp direkt efter blomning i juli. Tomt om ej relevant.",'
      + '"currentAdvice":"specifikt rad for just denna vaxt nu i ' + month + ' i Sverige",'
      + '"tip":"ett unikt proffstips for just denna art"} '
      + 'For utomhusvaxter och buskar: ange alltid fertilizing och pruning med exakta svenska manader. '
      + 'For buskar och trad ar pruning extra viktigt, beskriv teknik och timing. '
      + 'Sista frost Sverige: maj sodra Sverige, juni norra Sverige. '
      + 'For inomhusvaxter: pruning kan lämnas tomt om ej relevant.';

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: safeMime, data: imageData } },
          { type: 'text', text: prompt }
        ]}]
      })
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
