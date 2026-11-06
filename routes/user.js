var User = require('../models/user.js');
var listDocuments = require('./query.js');

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
            var user = new User();
            user.name = body.name;
            user.email = body.email;

            await user.save();
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
            user.name = body.name;
            user.email = body.email;

            await user.save();
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
            res.status(204).json({ message: '204: User deleted successfully', data: user });
        }
        catch(err){
            res.status(500).json({ message: '500: Could not delete user', data: null });
        }
    });

    return router; 
}
