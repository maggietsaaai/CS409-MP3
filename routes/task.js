var Task = require('../models/task.js');
var User = require('../models/user.js'); // needs to look up and update users
var listDocuments = require('./query.js');

// Checks assignedUser/assignedUserName. Returns { status, message } if invalid, or the values to save if OK
async function checkAssignment(body) {
    const assignedUser = body.assignedUser || ''; // missing → '' (unassigned)
    const assignedUserName = body.assignedUserName; // may be undefined

    if (assignedUser === '') { // unassigned: the name must be missing, '' or 'unassigned'
        if (assignedUserName !== undefined && assignedUserName !== '' && assignedUserName !== 'unassigned') {
            return { status: 400, message: '400: assignedUserName is set but assignedUser is not' };
        }
        return { assignedUser: '', assignedUserName: 'unassigned' };
    }
    if (typeof assignedUser !== 'string' || !/^[0-9a-fA-F]{24}$/.test(assignedUser)) { // malformed id in the BODY → 400
        return { status: 400, message: '400: assignedUser is not a valid user id' };
    }
    const user = await User.findById(assignedUser);
    if (!user) { // valid format, but nobody has this id → 404
        return { status: 404, message: '404: Assigned user not found' };
    }
    if (assignedUserName !== undefined && assignedUserName !== '' && assignedUserName !== user.name) { // name doesn't match → 400
        return { status: 400, message: '400: assignedUserName does not match the assigned user' };
    }
    return { assignedUser: assignedUser, assignedUserName: user.name }; // always save the real name
}

// After a task is saved: make users' pendingTasks match it
async function syncTaskToUsers(task) {
    const taskId = String(task._id); // pendingTasks stores ids as strings
    await User.updateMany({ pendingTasks: taskId }, { $pull: { pendingTasks: taskId } }); // remove it from everyone
    if (task.assignedUser !== '' && !task.completed) { // assigned and pending → add it back to its user only
        await User.updateOne({ _id: task.assignedUser }, { $addToSet: { pendingTasks: taskId } });
    }
}

module.exports = function (router) {

    var taskRoute = router.route('/tasks');

    taskRoute.get(async function (req, res) {
        try{
            await listDocuments(Task, req, res, 100);
        }
        catch(err){
            res.status(500).json({ message: '500: Could not get tasks', data: null });
        }

    });

    taskRoute.post(async function (req, res) {
        const body = req.body || {}; 

        try{
            if (typeof body.name !== 'string' || body.name.trim() === '') {
                return res.status(400).json({ message: '400: Name is required', data: null });
            }

            const deadline = new Date(body.deadline);
            if ((typeof body.deadline !== 'string' && typeof body.deadline !== 'number') || isNaN(deadline.getTime())) {
                return res.status(400).json({ message: '400: A valid deadline is required', data: null });
            }

            if (body.completed !== undefined && typeof body.completed !== 'boolean') {
                return res.status(400).json({ message: '400: completed must be a boolean', data: null });
            }

            const assignment = await checkAssignment(body);
            if (assignment.status) { // checkAssignment found a problem → send its status + message
                return res.status(assignment.status).json({ message: assignment.message, data: null });
            }

            var task = new Task();
            task.name = body.name;
            task.description = body.description || '';
            task.deadline = body.deadline;
            task.completed = body.completed || false;
            task.assignedUser = assignment.assignedUser;
            task.assignedUserName = assignment.assignedUserName;

            await task.save();
            await syncTaskToUsers(task); // update the other side (users' pendingTasks)
            res.status(201).json({ message: '201: Task created successfully', data: task });
        }
        catch(err){
            res.status(500).json({ message: '500: Could not create task', data: null });
        }
    });

    var taskIdRoute = router.route('/tasks/:id');

    taskIdRoute.get(async function (req, res) {
        
        try{
            if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
                return res.status(404).json({ message: '404: Task not found', data: null });
            }

            let select;                                  // stays undefined if no ?select=
            if (req.query.select !== undefined) {
                try {
                    select = JSON.parse(req.query.select);   // '{"name":1}' → { name: 1 }
                } 
                catch (e) {
                    return res.status(400).json({ message: '400: select must be valid JSON', data: null });
                }
            }

            const task = await Task.findById(req.params.id).select(select);
            if (!task) {
                return res.status(404).json({ message: '404: Task not found', data: null });
            }

            res.status(200).json({ message: '200: Task found', data: task });
        }
        catch(err){
            res.status(500).json({ message: '500: Could not get task', data: null });
        }
    });

    taskIdRoute.put(async function (req, res) {
        const body = req.body || {};
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
            return res.status(404).json({ message: '404: Task not found', data: null });
        }
        try{
            const task = await Task.findById(req.params.id);
            if (!task) {
                return res.status(404).json({ message: '404: Task not found', data: null });
            }
            if (typeof body.name !== 'string' || body.name.trim() === '') {
                return res.status(400).json({ message: '400: Name is required', data: null });
            }
            const deadline = new Date(body.deadline);
            if ((typeof body.deadline !== 'string' && typeof body.deadline !== 'number') || isNaN(deadline.getTime())) {
                return res.status(400).json({ message: '400: A valid deadline is required', data: null });
            }
            if (body.completed !== undefined && typeof body.completed !== 'boolean') {
                return res.status(400).json({ message: '400: completed must be a boolean', data: null });
            }
            const assignment = await checkAssignment(body);
            if (assignment.status) { // checkAssignment found a problem → send its status + message
                return res.status(assignment.status).json({ message: assignment.message, data: null });
            }

            task.name = body.name;
            task.description = body.description || '';
            task.deadline = body.deadline;
            task.completed = body.completed || false;
            task.assignedUser = assignment.assignedUser;
            task.assignedUserName = assignment.assignedUserName;

            await task.save();
            await syncTaskToUsers(task); // update the other side (users' pendingTasks)
            res.status(200).json({ message: '200: Task updated successfully', data: task });
        }
        catch(err){
            res.status(500).json({ message: '500: Could not update task', data: null });
        }
    });

    taskIdRoute.delete(async function (req, res) {
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
            return res.status(404).json({ message: '404: Task not found', data: null });
        }
        try{
            const task = await Task.findById(req.params.id);
            if (!task) {
                return res.status(404).json({ message: '404: Task not found', data: null });
            }
            await task.deleteOne();
            const taskId = String(task._id);
            await User.updateMany({ pendingTasks: taskId }, { $pull: { pendingTasks: taskId } }); // remove it from its user's pendingTasks
            res.status(204).send(); // 204 = success, no body
        }
        catch(err){
            res.status(500).json({ message: '500: Could not delete task', data: null });
        }
    });

    return router; 
}
