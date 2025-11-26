import * as service from './classify.service';
export async function run(req, res) {
    try {
        const n = await service.classifyUnprocessed();
        res.json({ processed: n });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'classify failed' });
    }
}
