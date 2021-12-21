const { MongoClient, TopologyOpeningEvent } = require("mongodb");
const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const auth = require("./auth.js");

// Express server stuff
const app = express();
const port = process.env.PORT;

// Increasing payload size
app.use(bodyParser.json({ limit: "50mb" }));
app.use(
    bodyParser.urlencoded({
        limit: "50mb",
        extended: true,
        parameterLimit: 50000,
    })
);

// Replace the following with your Atlas connection string
const client = new MongoClient(process.env.FINAL_URL);

// The database to use
const dbName = process.env.DBNAME;

// Middleware
app.use(express.static("public"));
app.use(bodyParser.json());
app.use(cors());

// Root route
app.get("/", (req, res) => {
    res.status(300).redirect("/info.html");
});

//////////////////////////////////////////////////////////////////////////////////
///                                   USERS                                    ///
//////////////////////////////////////////////////////////////////////////////////

app.get("/users", async (req, res) => {
    try {
        // Connecting to db
        await client.connect();
        // Retrieve the collection users
        const col = client.db(dbName).collection("users");
        const users = await col.find({}).toArray();

        // Send back the file
        res.status(200).send(users);
    } catch (e) {
        res.status(500).send({
            error: "Could not retrieve all users",
            value: e,
        });
    } finally {
        await client.close;
    }
});

// Returns user json
app.post("/users/register", async (req, res) => {
    try {
        // Connecting to db
        await client.connect();
        // Collection users
        const col = client.db(dbName).collection("users");

        // Validation
        // Checking if input fields are empty
        if (!req.body.username || !req.body.email || !req.body.password) {
            throw new Error("Bad request. You are either missing a username, email or password");
        }
        // Checking if username already exists
        const checkUsername = await col.findOne({
            username: req.body.username,
        });
        if (checkUsername) {
            throw new Error(`An account with username "${req.body.username}" already exists`);
        }
        // Checking if email already exists
        const checkUserEmail = await col.findOne({
            email: req.body.email,
        });
        if (checkUserEmail) {
            throw new Error(`An account with email "${req.body.email}" already exists`);
        }

        // Hashing password
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(req.body.password, salt);

        // Creating token
        const token = jwt.sign({ sub: req.body.email, password: hashedPassword }, `${process.env.TOKEN_KEY}`, { expiresIn: 60 * 60 });

        // Creating user
        let newUser = {
            user_id: Math.floor(Math.random() * 1000000000).toString(), // Assign random 9 digit number and convert to string to store in db
            username: req.body.username,
            email: req.body.email,
            password: hashedPassword,
            createdAt: new Date(),
            token: token,
        };

        // Insert into the database
        let insertRes = await col.insertOne(newUser);
        // Send back success message
        res.status(201).json(newUser);
    } catch (e) {
        res.status(500).send({
            error: e.name,
            value: e.message,
        });
    } finally {
        await client.close;
    }
});

// Returns user json
app.post("/users/login", async (req, res) => {
    try {
        // Connect
        await client.connect();
        const col = client.db(dbName).collection("users");

        // Validate that there is a username and a password in query
        if (!req.body.email || !req.body.password) {
            throw new Error("Missing email or password in body.");
        }
        // Look for account with given email
        const user = await col.findOne({ email: req.body.email });
        if (!user) {
            throw new Error("Account with this e-mail does not exist.");
        }
        // Compare the given password to the password stored in the database
        const isPasswordCorrect = bcrypt.compareSync(req.body.password, user.password);

        // Send success login message
        if (isPasswordCorrect) {
            // Create new token that expires in 1 hour
            const newToken = jwt.sign({ sub: req.body.email, password: user.password }, `${process.env.TOKEN_KEY}`, { expiresIn: 60 * 60 });
            // Replacing old user token with new token
            user.token = newToken;
            // Updating token in users collection
            const updatedUser = await col.updateOne({ email: req.body.email }, { $set: { token: newToken } });
            console.log(user.token);
            res.status(200).json(user);
        } else {
            throw new Error("Wrong password.");
        }
    } catch (e) {
        res.status(500).send({
            error: e.name,
            value: e.message,
        });
    } finally {
        await client.close;
    }
});

// Returns a single user found by username
app.get("/users/:username", async (req, res) => {
    try {
        await client.connect();

        const col = client.db(dbName).collection("users");
        const user = await col.findOne({ username: req.query.username }, { token: 0 });
        // No clue why it is not excluding token in json
        if (!user) {
            res.status(400).send({ message: `User with name ${req.query.username} does not exist.` });
        } else {
            res.status(200).send(user);
        }
    } catch (e) {
        console.log(e);
        res.status(500).send({
            error: e.name,
            value: e.message,
        });
    } finally {
        await client.close();
    }
});

// Delete user by email
app.delete("/users/:email", async (req, res) => {
    try {
        await client.connect();
        const col = client.db(dbName).collection("users");
        // TL;DR
        // //When a user first creates an account or logs in. The rest api will make a token for him
        // //This token will be returned as a json document when making a post register or login call
        // //This token should be stored in a cookie before redirecting the user to the homepage.
        // // User can only delete his own account

        // // // // These comments dont apply yet because I have currently disabled auth tokens

        // Determining who the user is for success message handling
        const deletedUser = await col.findOne({ email: `${req.query.email}` });
        // // Delete user based on the token given along with the header (Token should be obtained from cookie upon login/registering)
        // // to make sure the user is deleting himself

        // Deleting user based on email
        const deleteUser = await col.deleteOne({ email: `${req.query.email}` });
        if (deleteUser.deletedCount === 1) {
            res.status(200).send({ message: `User ${deletedUser.username} successfully deleted` });
        } else {
            res.status(404).send({ message: `No users founds. Deleted 0 users` });
        }
    } catch (e) {
        console.log(e);
        res.status(500).send({
            error: e.name,
            value: e.message,
        });
    } finally {
        await client.close();
    }
});

//////////////////////////////////////////////////////////////////////////////////
///                                 ROUTES                                     ///
//////////////////////////////////////////////////////////////////////////////////

// Get all routes
app.get("/routes", async (req, res) => {
    try {
        // Connect
        await client.connect();
        const col = client.db(dbName).collection("routes");
        const routes = await col.find({}).toArray();
        // Send back the file
        res.status(200).send(routes);
    } catch (e) {
        res.status(500).send({
            error: "Could not retrieve all routes",
            value: e,
        });
    } finally {
        await client.close;
    }
});

// Get routes by city || Optional parameter user_id
app.get("/routes/city/:city", async (req, res) => {
    try {
        // Connect
        await client.connect();
        const colU = client.db(dbName).collection("users");
        const colR = client.db(dbName).collection("routes");
        // Validation
        if (!req.query.city) {
            throw new Error("Please provide a city");
        }
        // Making input lowercase
        const str = req.query.city.toLowerCase();
        // Making 1st character a capital
        const city = str.charAt(0).toUpperCase() + str.slice(1);
        // Assign user if there is a user_id passed along in the query
        let routes;
        if (req.query.user_id) {
            const user = await colU.findOne({ user_id: req.query.user_id });
            if (!user) {
                throw new Error(`No user with the id ${req.query.user_id} found.`);
            }
            // Find route for user
            routes = await colR.find({ $and: [{ "route_start_location.city": city, created_by: user.username }] }).toArray();
            if (!routes || routes.length == 0) {
                throw new Error(`No routes in ${city} for ${user.username} found.`);
            }
        } else {
            // Find route for city || Route can be made by anyone
            routes = await colR.find({ "route_start_location.city": city }).toArray();
        }

        // Send back the file
        res.status(200).send(routes);
    } catch (e) {
        console.log(e);
        res.status(500).send({
            error: "Could not retrieve all routes",
            value: e.message,
        });
    } finally {
        await client.close;
    }
});

// Getting routes for an user based on their email (stored in cookie)
app.get("/routes/user/:id", async (req, res) => {
    try {
        // Connect
        await client.connect();
        // Routes col
        const colR = client.db(dbName).collection("routes");
        // User Col
        const colU = client.db(dbName).collection("users");
        // Validation
        if (!req.query.id) {
            throw new Error("Please provide a user id in the query");
        }
        // Assigning user with the given email
        const user = await colU.findOne({ user_id: req.query.id });
        if (!user) {
            throw new Erorr(`User with id ${req.query.id} does not exist.`);
        }

        // Getting routes made by the user
        const routes = await colR.find({ created_by: user.username }).toArray();
        if (!routes) {
            throw new Error("You don't have any routes.");
        }

        res.status(200).send(routes);
    } catch (e) {
        console.log(e);
        res.status(500).send({
            error: "Something went wrong...",
            value: e.message,
        });
    } finally {
        await client.close();
    }
});

// Create new routes
app.post("/routes", async (req, res) => {
    try {
        // Connect
        await client.connect();
        const col = client.db(dbName).collection("routes");

        // Validation;
        if (
            !req.body.created_by ||
            !req.body.route_start_location ||
            !req.body.route_coordinates ||
            !req.body.route_img_url ||
            !req.body.route_name ||
            !req.body.route_polyline_encoded
        ) {
            throw new Error(
                "Make sure you have all parameters filled in. Needs a 'created_by', 'route_coordinates','route_img_url', 'route_name' and 'route_polyline_encoded'"
            );
        }
        // Randomize id with 9 digits
        const id = Math.floor(Math.random() * 1000000000);
        const strId = id.toString();

        // Create the file
        const newRoute = {
            created_by: req.body.created_by,
            route_id: strId,
            route_name: req.body.route_name,
            route_start_location: req.body.route_start_location,
            route_coordinates: req.body.route_coordinates,
            route_polyline_encoded: req.body.route_polyline_encoded,
            route_img_url: req.body.route_img_url,
        };

        // Push file to collection
        let insert = await col.insertOne(newRoute);

        // // Send back file
        res.status(200).send(newRoute);
    } catch (e) {
        res.status(500).send({
            error: e.message,
            value: e,
        });
    } finally {
        await client.close();
    }
});

// Delete route by id
app.delete("/routes/id/:id", async (req, res) => {
    try {
        // Connect
        await client.connect();
        const col = client.db(dbName).collection("routes");
        const colFR = client.db(dbName).collection("favorite_routes");
        console.log(req.query.id);
        // Validation
        if (!req.query.id) {
            throw new Error("Please provide an id");
        }
        // Doing this for success message handling
        const route = await col.findOne({ route_id: req.query.id });
        // Actually deleting
        const deletedRoute = await col.deleteOne({ route_id: req.query.id });
        // Deleting the route from the favorite collections aswell
        const deleteFavRoute = await colFR.deleteOne({ route_id: req.query.id });
        // Deleting user based on email
        if (deletedRoute.deletedCount === 1) {
            res.status(200).send({ message: `Route with the name: ${route.route_name} successfully deleted` });
        } else {
            res.status(404).send({ message: `No routes with id ${req.query.id} found. Deleted 0 routes` });
        }
    } catch (e) {
        res.status(500).send({
            error: e.message,
        });
    } finally {
        await client.close();
    }
});

// Should only be used to clear all data, this action is irreversible
app.delete("/routes/all", async (req, res) => {
    try {
        await client.connect();
        const col = client.db(dbName).collection("routes");
        const colFR = client.db(dbName).collection("favorite_routes");
        // Validation
        if (!req.query.deleteKey) {
            throw new Error("Please provide a delete key");
        }

        // Adding authorization
        if (process.env.DELETEKEY != req.query.deleteKey) {
            res.status(413).send("Not authorized.");
        }

        // If key is given and matches
        if (process.env.DELETEKEY == req.query.deleteKey) {
            await col.deleteMany({});
            await colFR.deleteMany({});
            res.status(200).send("Deleted all routes");
        } else {
            throw new Error("Something went wrong, please try again later..");
        }
    } catch (e) {
        res.status(500).send({
            error: e.message,
        });
    } finally {
        await client.close();
    }
});

//////////////////////////////////////////////////////////////////////////////////
///                              FAVORITE ROUTES                               ///
//////////////////////////////////////////////////////////////////////////////////

// Get favorite_routes linked to a user_id
app.get("/routes/favorite_routes/:id", async (req, res) => {
    try {
        // Connect
        await client.connect();
        const colU = client.db(dbName).collection("users");
        const colR = client.db(dbName).collection("routes");
        const colFR = client.db(dbName).collection("favorite_routes");

        // Validation
        if (!req.query.id) {
            throw new Error("Please pass along a user_id in the query.");
        }
        // Get the user requesting his favorite routes
        const user = await colU.findOne({ user_id: req.query.id });

        // Look for favorite routes for user
        const favorite_route = await colFR.find({ user_id: req.query.id }).toArray();

        // If user doesn't have any favorite routes
        if (favorite_route.length == 0) {
            throw new Error(`${user.username} does not have any favorite routes.`);
        }

        res.status(200).send(favorite_route);
    } catch (e) {
        res.status(500).send({
            error: "Something went wrong, please try again later...",
            value: e.message,
        });
    } finally {
        await client.close();
    }
});

// Adding routes to favorite based on user id
app.post("/routes/favorite_routes/:route_id", async (req, res) => {
    try {
        // Connect
        await client.connect();
        const colU = client.db(dbName).collection("users");
        const colR = client.db(dbName).collection("routes");
        const colFR = client.db(dbName).collection("favorite_routes");

        // Validation for route id in query
        if (!req.query.route_id) {
            throw new Error("Please provide a route_id in the query");
        }
        // Validation for user_id in body
        if (!req.body.user_id) {
            throw new Error("Please provide a user_id in the body");
        }
        // Find route linked to the route_id to get the route_name
        const route = await colR.findOne({ route_id: req.query.route_id });
        if (!route) {
            throw new Error(`There are no routes with the id: ${req.query.route_id}`);
        }
        // Find user linked to the user_id to get the username
        const user = await colU.findOne({ user_id: req.body.user_id });
        if (!user) {
            throw new Error(`There are no users with the id: ${req.query.user_id}`);
        }

        const favorite_route = {
            route_name: route.route_name,
            route_id: req.query.route_id,
            user_id: req.body.user_id,
            username: user.username,
        };

        // Validate to see if there are undefined variables in our favorite_route object
        if (!favorite_route.route_name || !favorite_route.user_id || !favorite_route.route_id || !favorite_route.username) {
            throw new Error("One of the required fields inside object favorite_route is undefined");
        }

        // Validate for duplicates
        const stored_favorite_route = await colFR.findOne({ user_id: req.body.user_id, route_id: req.query.route_id });
        if (stored_favorite_route) {
            throw new Error("You already have this route saved as your favorite.");
        }

        await colFR.insertOne(favorite_route);

        res.status(200).send(favorite_route);
    } catch (e) {
        console.log(e);
        res.status(500).send({
            error: "Something went wrong, please try again later...",
            value: e.message,
        });
    } finally {
        await client.close();
    }
});

// Deleting route from favorites based on user id
app.delete("/routes/favorite_routes/:route_id", async (req, res) => {
    try {
        // Connect
        await client.connect();
        const colU = client.db(dbName).collection("users");
        const colFR = client.db(dbName).collection("favorite_routes");

        // Determining the user to delete the favorite route from
        // Validation for user
        console.log("test");
        if (!req.body.user_id) {
            throw new Error("Please provide a user_id in the body");
        }
        // Finding user
        console.log("2");
        const user = await colU.findOne({ user_id: req.body.user_id });
        // Not found
        console.log("3");
        if (!user) {
            throw new Error(`No user with id ${req.body.user_id} found`);
        }
        console.log("4");
        // Validation for favorite route
        if (!req.query.route_id) {
            throw new Error("Please provide a route_id in the query");
        }
        console.log("5");
        // Finding route
        const route = await colFR.findOne({ route_id: req.query.route_id });
        // Not found
        console.log("6");
        if (!route) {
            throw new Error(`No route with id ${req.query.route_id} found`);
        }
        console.log("7");
        // Deleting from favorites
        const deletedRoute = await colFR.deleteOne({ $and: [{ route_id: route.route_id }, { user_id: user.user_id }] });
        if (deletedRoute.deletedCount === 1) {
            res.status(200).send({ message: `Route with the name: ${route.route_name} successfully deleted from ${user.username}'s favorites` });
        } else {
            res.status(404).send({ message: `No routes with id ${req.query.id} found. Deleted 0 routes` });
        }
    } catch (e) {
        console.log(e);
        res.status(500).send({
            error: "Something went wrong, please try again later...",
            value: e.message,
        });
    } finally {
        await client.close();
    }
});

app.listen(port, () => {
    console.log(`Api is running at http://localhost:${port}`);
});
