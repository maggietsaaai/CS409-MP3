var Task = require('../models/task.js');
var listDocuments = require('./query.js');

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

            var task = new Task();
            task.name = body.name;
            task.description = body.description || '';
            task.deadline = body.deadline;
            task.completed = body.completed || false;
            task.assignedUser = body.assignedUser || '';
            task.assignedUserName = body.assignedUserName || 'unassigned';

            await task.save();
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
            task.name = body.name;
            task.description = body.description || '';
            task.deadline = body.deadline;
            task.completed = body.completed || false;
            task.assignedUser = body.assignedUser || '';
            task.assignedUserName = body.assignedUserName || 'unassigned';

            await task.save();
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
            res.status(204).json({ message: '204: Task deleted successfully', data: task });
        }
        catch(err){
            res.status(500).json({ message: '500: Could not delete task', data: null });
        }
    });

    return router; 
}
