var User = require('../models/user.js'); // load the User model (../ = up one folder); home.js/index.js don't need it, they never touch the database

module.exports = function (router) {

    var userRoute = router.route('/users'); // '/api' prefix (index.js) + '/users' = /api/users

    userRoute.get(async function (req, res) { // async: needed to use await inside
        try{ // if an awaited call fails, it throws -> jump to catch and send our own response
            const users = await User.find(); // const: never reassigned; await: pause until the Promise's result is ready
            res.status(200).json({ message: 'Users found', data: users }); // 200 = OK, success with a body; always { message, data }
        }
        catch(err){
            res.status(500).json({ message: 'Could not get users', data: null }); // 500 = broke on our side; don't send err.message (Mongoose's text)
        }

    });

    userRoute.post(async function (req, res) {
        try{
            var user = new User();
            user.name = req.body.name;   // copy only allowed fields (not new User(req.body)),
            user.email = req.body.email; // so a client can't set dateCreated
            await user.save(); // fills in defaults, throws if a required field is missing
            res.status(201).json({ message: 'User created successfully', data: user }); // 201 = Created: success, and something new was created
        }
        catch(err){
            res.status(500).json({ message: 'Could not create user', data: null });
        }
    });

    return router;
}
