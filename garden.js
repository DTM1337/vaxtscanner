export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { plantName, scientificName } = req.body;
    if (!plantName) return res.status(400).json({ error: 'plantName saknas' });

    const prompt = `Ge ett odlingsschema for "${plantName}"${scientificName ? ' (' + scientificName + ')' : ''} anpassat for Sverige.
Svara ENDAST med JSON utan kodblock:
{
  "plantType": "grönsak|frukt|bär|buske|träd|blomma|krukväxt|perenner",
  "schedule": {
    "januari": {"action": "", "tip": ""},
    "februari": {"action": "", "tip": ""},
    "mars": {"action": "", "tip": ""},
    "april": {"action": "", "tip": ""},
    "maj": {"action": "", "tip": ""},
    "juni": {"action": "", "tip": ""},
    "juli": {"action": "", "tip": ""},
    "augusti": {"action": "", "tip": ""},
    "september": {"action": "", "tip": ""},
    "oktober": {"action": "", "tip": ""},
    "november": {"action": "", "tip": ""},
    "december": {"action": "", "tip": ""}
  }
}
action = kort beskrivning av vad man ska göra den månaden (tomt om ingenting). Max 8 ord.
tip = kort förklarande tips (tomt om ingenting). Max 15 ord.
Exempel action: "Förodla inomhus", "Plantera ut efter frost", "Gödsla varannan vecka", "Klipp tillbaka", "Vila"
Tänk på: sista frost södra Sverige maj, norra Sverige juni.`;

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await apiRes.json();
    if (!apiRes.ok) throw new Error(data.error?.message || JSON.stringify(data));

    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock) throw new Error('Inget svar från API');

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
