module.exports = {
    "env": {
        "browser": true,
        "es6": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 2016
    },
    "rules": {
        "indent": [
            "error",
            4
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "single"
        ],
        "semi": [
            "error",
            "always"
        ],
        "curly": [
            "error",
            "all"
        ],
        "eqeqeq": [
            "warn",
            "always"
        ],
        "guard-for-in": "warn",
        "no-shadow": "warn",
        "max-lines-per-function": [
            "warn",
            50
        ],
        "no-bitwise": "warn",
        "no-trailing-spaces": "error",
        "eol-last": "error",
    }
};