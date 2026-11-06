var User = require('../models/user.js');
var Task = require('../models/task.js'); // user.js now needs to look up and update tasks
var listDocuments = require('./query.js');

// Checks body.pendingTasks. Returns { status, message } if invalid, or { list } (the task ids to save) if OK
async function checkPendingTasks(body) {
    let list = body.pendingTasks;
    if (list === undefined || list === null) list = []; // missing → empty list
    if (!Array.isArray(list)) { // not a list → 400
        return { status: 400, message: '400: pendingTasks must be a list of task ids' };
    }
    if (list.some(id => typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id))) { // any malformed id → 400
        return { status: 400, message: '400: pendingTasks contains an invalid task id' };
    }
    list = [...new Set(list)]; // remove duplicates (a Set keeps each value once; [...] turns it back into an array)

    const tasks = await Task.find({ _id: { $in: list } }); // all tasks whose _id is in the list
    if (tasks.length !== list.length) { // some id matched no task → 404
        return { status: 404, message: '404: A task in pendingTasks does not exist' };
    }
    if (tasks.some(t => t.completed)) { // a completed task can't be pending → 400
        return { status: 400, message: '400: A completed task cannot be in pendingTasks' };
    }
    return { list: list };
}

// After a user is saved: make the tasks match the user's pendingTasks (and name)
async function syncUserToTasks(user) {
    const uid = String(user._id); // assignedUser stores ids as strings
    const list = user.pendingTasks;
    await Task.updateMany( // 1. this user's pending tasks that are no longer in the list → unassigned
        { assignedUser: uid, completed: false, _id: { $nin: list } },
        { $set: { assignedUser: '', assignedUserName: 'unassigned' } });
    await User.updateMany( // 2. tasks in the list that another user had → remove them from that user
        { _id: { $ne: user._id }, pendingTasks: { $in: list } },
        { $pull: { pendingTasks: { $in: list } } });
    await Task.updateMany( // 3. tasks in the list → assigned to this user
        { _id: { $in: list } },
        { $set: { assignedUser: uid } });
    await Task.updateMany( // 4. all of this user's tasks (completed too) get the current name
        { assignedUser: uid },
        { $set: { assignedUserName: user.name } });
}

module.exports = function (router) {

    var userRoute = router.route('/users');

    userRoute.get(async function (req, res) {
        try{
            await listDocuments(User, req, res); // no 4th argument → defaultLimit is undefined → no limit
        }
        catch(err){
            res.status(500).json({ message: '500: Could not get users', data: null });
        }

    });

    userRoute.post(async function (req, res) {
        const body = req.body || {}; 

        try{
            if (typeof body.name !== 'string' || body.name.trim() === '' || typeof body.email !== 'string' || body.email.trim() === '') {
                return res.status(400).json({ message: '400: Name and email are required', data: null });
            }
            if (await User.findOne({ email: body.email })) {
                return res.status(400).json({ message: '400: Email already exists', data: null });
            }
            const pending = await checkPendingTasks(body);
            if (pending.status) { // checkPendingTasks found a problem → send its status + message
                return res.status(pending.status).json({ message: pending.message, data: null });
            }
            var user = new User();
            user.name = body.name;
            user.email = body.email;
            user.pendingTasks = pending.list;

            await user.save();
            await syncUserToTasks(user); // update the other side (the tasks)
            res.status(201).json({ message: '201: User created successfully', data: user });
        }
        catch(err){
            if (err.code === 11000) return res.status(400).json({ message: '400: Email already exists', data: null });
            res.status(500).json({ message: '500: Could not create user', data: null });
        }
    });

    var userIdRoute = router.route('/users/:id');

    userIdRoute.get(async function (req, res) {
        
        try{
            if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
                return res.status(404).json({ message: '404: User not found', data: null });
            }

            let select;                                  // stays undefined if no ?select=
            if (req.query.select !== undefined) {
                try {
                    select = JSON.parse(req.query.select);   // '{"name":1}' → { name: 1 }
                } 
                catch (e) {
                    return res.status(400).json({ message: 'select must be valid JSON', data: null });
                }
            }

            const user = await User.findById(req.params.id).select(select);
            if (!user) {
                return res.status(404).json({ message: '404: User not found', data: null });
            }

            res.status(200).json({ message: '200: User found', data: user });
        }
        catch(err){
            res.status(500).json({ message: '500: Could not get user', data: null });
        }
    });

    userIdRoute.put(async function (req, res) {
        const body = req.body || {};
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
            return res.status(404).json({ message: '404: User not found', data: null });
        }
        try{
            const user = await User.findById(req.params.id);
            if (!user) {
                return res.status(404).json({ message: '404: User not found', data: null });
            }
            if (typeof body.name !== 'string' || body.name.trim() === '' || typeof body.email !== 'string' || body.email.trim() === '') {
                return res.status(400).json({ message: '400: Name and email are required', data: null });
            }
            if (body.email && body.email !== user.email && await User.findOne({ email: body.email })) {
                return res.status(400).json({ message: '400: Email already exists', data: null });
            }
            const pending = await checkPendingTasks(body);
            if (pending.status) { // checkPendingTasks found a problem → send its status + message
                return res.status(pending.status).json({ message: pending.message, data: null });
            }
            user.name = body.name;
            user.email = body.email;
            user.pendingTasks = pending.list; // PUT replaces: missing pendingTasks → []

            await user.save();
            await syncUserToTasks(user); // update the other side (the tasks)
            res.status(200).json({ message: '200: User updated successfully', data: user });
        }
        catch(err){
            if (err.code === 11000) return res.status(400).json({ message: '400: Email already exists', data: null });
            res.status(500).json({ message: '500: Could not update user', data: null });
        }
    });

    userIdRoute.delete(async function (req, res) {
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
            return res.status(404).json({ message: '404: User not found', data: null });
        }
        try{
            const user = await User.findById(req.params.id);
            if (!user) {
                return res.status(404).json({ message: '404: User not found', data: null });
            }
            await user.deleteOne();
            await Task.updateMany( // unassign ALL of this user's tasks, completed ones too
                { assignedUser: String(user._id) },
                { $set: { assignedUser: '', assignedUserName: 'unassigned' } });
            res.status(204).send(); // 204 = success, no body
        }
        catch(err){
            res.status(500).json({ message: '500: Could not delete user', data: null });
        }
    });

    return router; 
}
