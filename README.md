# Shribe - an interactive text chat using WebSockets
## based on Node.js, Socket.io and MySQL

A project by Valentin Kuba, Sebastian Schmid & Michael Troger.

### Installation: 
1. `npm install`
2. Setup your database and link it in a file called `config/database.js` like:
    ```
    module.exports = {
      host: YOUR-HOST,
      user: YOUR-USER,
      password: YOUR-PASSWORD,
      database: YOUR-DATABASE
    };
    ```
3. Setup your SMTP server for sending emails in a file called `config/email.js` like:
    ```
    module.exports = {
        host: YOUR-HOST,
        port: YOUR-PORT,
        auth: {
            user: YOUR-USERNAME,
            pass: YOUR-PASSWORD
        }
    };
    ```
4. Setup your Redis database for session storage in a file called `config/redis.js` like:
    ```
    module.exports = {
        host: YOUR-HOST,
        port: YOUR-PORT,
        pass: YOUR-PASSWORD
    };
    ```

### Launch: 
`npm start`
