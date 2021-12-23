# RoutExplore - Never Stop Exploring - Backend

Reminder that this repository is not being used for commercial purposes. I am using this repository for a school project for the course WEB2 given by teacher Mike Derycke[^1].

To know more about how to use my REST API, you can find the documentation [here](https://web2-routexploreapi.herokuapp.com)

Frontend repository can be found [here](https://github.com/EHB-MCT/web2-frontend-StephanVanHemelrijck)

## Packages used

- [mongodb](https://www.npmjs.com/package/mongodb)
- [express](https://www.npmjs.com/package/express)
- [body-parser](https://www.npmjs.com/package/body-parser)
- [dotenv](https://www.npmjs.com/package/dotenv)
- [cors](https://www.npmjs.com/package/cors)
- [bcryptjs](https://www.npmjs.com/package/bcryptjs)
- [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken)

## Downloading and installing packages locally

Make sure you have first made your folder a npm project. To do so, open your folder in the integrated terminal, then run
```
npm init -y
```

These packages are public, which means they can be searched, downloaded or installed by anyone. To install a public package, on the command line, run
```
npm install <package_name>
```
Or the shortened version
```
npm i <package_name>
```
To make your life easier...

```
npm i mongodb express body-parser dotenv cors bcryptjs jsonwebtoken
```

For those who are curious and would like to read more about using packages or modules, make sure to visit [npm](https://www.npmjs.com/). and read their [docs](https://docs.npmjs.com/).

## Sources used

Regarding throwing customs errors or error handling in general
- https://linuxhint.com/create-custom-error-using-throw-javascript/
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/throw

Middleware for authentication and creating tokens.[^2]
- https://www.section.io/engineering-education/how-to-build-authentication-api-with-jwt-token-in-nodejs/

Increasing payload size
- https://stackoverflow.com/questions/19917401/error-request-entity-too-large

Randomize 9 digit number
- https://stackoverflow.com/questions/3437133/javascript-generate-a-random-number-that-is-9-numbers-in-length/3437180

Group project repository
- https://github.com/EHB-MCT/web2-groupproject-backend-team-arno/blob/main/index.js

[^1]: Special thanks to Mike Derycke for his lessons and [coding along videos](https://www.youtube.com/watch?v=oJ1QuQaCD0w&list=PLGsnrfn8XzXii2J5-Jpqufypu6upxcSGx&index=19).
[^2]: Authentication tokens are currently not being used. But that link is where I got the code in /auth.js from.
