const jwt = require("jsonwebtoken");
require("dotenv").config();

// Currently disabled because I'm having issues with verifying the token on the client side
// If the token is created within postman it is valid according to jwt.io
// But if the token is created using the client side (which uses the same rest api call), it is appearing to be unvalid for some reason
const verifyToken = (req, res, next) => {
    const token = req.body.token || req.query.token || req.headers["auth"];

    if (!token) {
        return res.status(403).send({ message: "A token is required for authentication" });
    }
    try {
        const decoded = jwt.verify(token, process.env.TOKEN_KEY);
        console.log("decoded", decoded);
        req.user = decoded;
    } catch (err) {
        return res.status(401).send({ message: "Invalid Token" });
    }
    return next();
};

module.exports = verifyToken;
