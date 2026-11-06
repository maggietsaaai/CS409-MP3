// Shared GET-list logic for /users and /tasks: where, sort, select, skip, limit, count
async function listDocuments(Model, req, res, defaultLimit) {
    let where, sort, select;
    try {
        if (req.query.where !== undefined)  where  = JSON.parse(req.query.where);
        if (req.query.sort !== undefined)   sort   = JSON.parse(req.query.sort);
        if (req.query.select !== undefined) select = JSON.parse(req.query.select);
    } catch (e) {
        return res.status(400).json({ message: '400: Invalid query parameters', data: null });
    }
    where = where || {};

    if (req.query.count === 'true') {
        const count = await Model.countDocuments(where);
        return res.status(200).json({ message: '200: Count found', data: count });
    }

    let limit = defaultLimit;                       // 100 for tasks, undefined for users
    if (req.query.limit !== undefined) limit = parseInt(req.query.limit);
    let skip = 0;
    if (req.query.skip !== undefined) skip = parseInt(req.query.skip);
    if ((limit !== undefined && (isNaN(limit) || limit < 0)) || isNaN(skip) || skip < 0) {
        return res.status(400).json({ message: '400: skip and limit must be non-negative numbers', data: null });
    }

    let query = Model.find(where);
    if (sort)   query = query.sort(sort);
    if (select) query = query.select(select);
    query = query.skip(skip);
    if (limit !== undefined) query = query.limit(limit);

    const docs = await query;
    res.status(200).json({ message: '200: OK', data: docs });
}

module.exports = listDocuments;
