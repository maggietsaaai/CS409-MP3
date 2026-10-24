var User = require('../models/user.js');

module.exports = function (router) {

    var userRoute = router.route('/users');

    userRoute.get(async function (req, res) {
        try{
            const users = await User.find();
            res.status(200).json({ message: '200: Users found', data: users });
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

    return router; 
}
