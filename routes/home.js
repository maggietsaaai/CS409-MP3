module.exports = function (router) {

    var homeRoute = router.route('/'); // create a route for the home page

    homeRoute.get(function (req, res) { // what happens when a GET request is made to the home route
        var connectionString = process.env.TOKEN;
        res.json({ message: 'My connection string is ' + connectionString });
    });

    return router;
}
