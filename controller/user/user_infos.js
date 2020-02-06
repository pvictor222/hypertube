'use strict'

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const router = express.Router();
const with_auth = require('./authentification_middleware');
const user = require('../../model/connection.js');
const imgChecker = require('../../model/imageChecker');
const user_infos = require('../../model/user_infos_model.js');
const uuid = require('uuid/v4');
const fs = require('fs');

router.use(cookieParser());
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));

// To upload the profile picture
const path = require("path");
const multer = require("multer");
const uuid_photo = uuid();
const storage = multer.diskStorage({
    destination: "./views/public/profile_pictures",
    filename: function(req, file, cb){
       cb(null,"IMAGE-" + Date.now() + uuid_photo + path.extname(file.originalname));
    }
});
// const upload = multer({dest: __dirname + '/../public/images'});
const upload = multer({
    storage: storage,
    limits:{fileSize: 1000000},
}).single("myImage");

// Allow Cross-origin requests
const cors = require('cors')
router.options("http://localhost:3000", cors());
router.use(cors({origin: "http://localhost:3000", credentials: true}));

// **** GET USER INFORMATION FROM THE COOKIES **** //
router.post('/user_infos', with_auth, async (req, res) => {
    let user_infos = await user.get_users(req.uuid);
    res.status(200).send(user_infos);
});

// **** UPDATE USER INFORMATION (login, email, first and last name) **** //
router.post('/update_account', with_auth, async (req, res) => {
    let login = req.body.body.split('login: "')[1].split('"')[0];
    let email = req.body.body.split('email: "')[1].split('"')[0];
    let first_name = req.body.body.split('first_name: "')[1].split('"')[0];
    let last_name = req.body.body.split('last_name: "')[1].split('"')[0];
    let user_update = await user_infos.update_user_infos(login, first_name, last_name, email, req.uuid);
    if (user_update == 1 ){
        res.status(201).send('User information updated');
    }
    else {
        res.status(204).send('You cannot use this email');
    }
    
});

// **** CHANGE PASSWORD **** //
router.post('/update_password', with_auth, async (req, res) => {
    let new_password = req.body.body.split('new_password: "')[1].split('"')[0];
    let confirm_password = req.body.body.split('confirm_password: "')[1].split('"')[0];
    let old_password = req.body.body.split('old_password: "')[1].split('"')[0];
    let login = req.body.body.split('login: "')[1].split('"')[0];
    if (new_password !== confirm_password)
        res.status(418).send('Passwords don\'t match');
    else {
        let uuid = await user.user_connect(login, old_password);
        if (uuid == '0') {
          res.status(401);
          res.send("Connection refused: the password is wrong.");
        } else {
            user_infos.update_password(new_password, req.uuid);
            res.status(201).send('User information updated');
        }
    }
});

// **** UPDATE PROFILE PICTURE **** //
router.post("/profile_picture", with_auth, async (req, res) => {
    let uuid_user = req.uuid;
    upload(req, res, (err) => {
        if (req.file.mimetype !== 'image/jpg' & req.file.mimetype !== 'image/jpeg' & req.file.mimetype !== 'image/png')
            res.status(200).send('Wrong file format: only jpg, jpeg and png are accepted');
        else if (err) {
            res.status(200).send('An error has occured, please try again later');
        }
        else {
            let file_path = req.file.path;
            imgChecker.checkImg(req.file.path, req.file.mimetype).then((result) => {
                if (result === true) {
                    fs.chmodSync(file_path, '777');
                    user_infos.update_picture(file_path, uuid_user);
                    res.status(200).send('Your profile picture has been successfully updated');
                } else {
                    res.status(200).send('Not a valid file')
                }
            }).catch((reason) => {
                console.log('Failed to check image: ' + reason);
                res.status(200).send('Error')
            })
        }
    });
 });

// **** UPDATE DARK MODE **** //
router.post('/dark_mode', with_auth, async(req, res) => {
    let infos = await user.get_users(req.uuid);
    user_infos.dark_mode_update((JSON.parse(infos))[0].dark_mode, req.uuid);
})

// **** UPDATE DARK MODE **** //
router.post('/user_public_profile', with_auth, async(req, res) => {
    if (req && req.body && req.body.uuid != '') {
        let public_profile = await user_infos.get_public_profile(req.body.uuid);
        if (public_profile == 'vide'){
            res.sendStatus(204);
        }
        else{
           res.send(public_profile[0]).status(200);
        }
    } else {
        res.sendStatus(403);
    }
})

// **** UPDATE LANGUAGE **** //
router.post('/update_language', with_auth, async(req, res) => {
    if (req && req.body && req.uuid != '' && (req.body.language == 'fr' || req.body.language == 'en')) {
        user_infos.language_update(req.uuid, req.body.language);
    }
})

module.exports = router;