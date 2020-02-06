'use strict'

const with_auth = require('../user/authentification_middleware');
const fs = require("fs");
const express = require('express');
const router = express.Router();
// model functions
const films = require('../../model/films.js');
const torrents = require('../torrent/torrent.js');

// To get all the movies viewed by the user
router.post('/movies_seen', with_auth, async (req, res) =>{
    let movies_seen = await films.movie_seen(req.uuid);
    if (movies_seen === false)
        res.sendStatus(404);
    else
        res.send(movies_seen).status(200);
})

router.get('/moviedb', with_auth, async (req, res) => {
    if (!req.query.action || (req.query.action != "popular" && req.query.action != "search" && req.query.action != "similar")) {
        res.status(400);
        res.send("Specify the action to be performed: 'popular' to get popular movies, 'search' to get a particular movie");
    } else {
        // Optional [public] --> 'G' for general public, 'R' for restricted. Default is 'all'
        // Optional [page] --> return the n-page
        // Optional [category] --> 'drama', 'western', etc. By default 'all'
        let public_category = req.query.public && (req.query.public == "G") ? req.query.public : "all";
        let category = (req.query.category) ? req.query.category : "all";
        let rating = (req.query.rating) ? req.query.rating : '1';
        let duration = (req.query.duration) ? req.query.duration : '';
        let decade = (req.query.decade) ? req.query.decade : '';
        let page = 1;
        // ** POPULAR ** --> returns the most popular movies
        if (req.query.action.toLowerCase() == "popular") {
            if (req.query.page)
                page = req.query.page;
            let popular_movies = await films.popular_movies(page, public_category, category, rating, duration, decade, req.query.language);
            if (popular_movies == '')
                res.status(204);
            else
                res.status(200);
            res.send(popular_movies.results);
        }
        // ** SEARCH ** --> search movies by name
        else if (req.query.action.toLowerCase() == "search") {
            let name = req.query.movie_name;
            page = req.query.page;
            let search_movies = await films.search_movies(page, public_category, category, name, rating, duration, decade, req.query.language);
            if (search_movies == '')
                res.status(204);
            else
                res.status(200);
            res.send(search_movies.results);
        }
        // ** SIMILAR ** --> get movies that are similar to the parameter "movie_ID"
        else if (req.query.action.toLowerCase() == "similar" && req.query.language != '') {
            let similar_movies = await films.similar_movies(req.query.movie_id, req.query.language);
            if (similar_movies == '' || similar_movies.status_code == 34)
                res.status(204);
            else
                res.status(200);
            res.send(similar_movies.results);
        }
        // https://developers.themoviedb.org/3/movies/get-similar-movies
    }
});

router.get('/movie_infos', with_auth, async (req, res) => {
    if (req.query.movie_id && req.query.movie !== ""&& req.query.language && req.query.language != '') {
        let movie_infos = await films.movie_infos(req.query.movie_id, req.query.language);
        if (movie_infos == '' || movie_infos.status_code == 34)
            res.status(204);
        else {
            movie_infos.revenue = movie_infos.revenue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            res.status(200).send(movie_infos);
        }
    }
});

router.get('/movie_cast', with_auth, async (req, res) => {
    if (req.query.movie_id && req.query.movie !== "") {
        let movie_cast = await films.movie_cast(req.query.movie_id);
        if (movie_cast == '')
            res.status(204);
        else
            res.status(200).send(movie_cast);
    }
});

/*
a. Si il est telechargé (fini), on renvoie le {status: 'finish', movie_infos: movie_infos}
b. Si il est telecharge (en cours), on renvoie {status: 'downloading', movie_infos: movie_infos}
c. Sinon on cherche le film :
    i. Si on le trouve (verification des infos), on commence a telecharger (celui avec le plus de seeders) 
            et on renvoie {status: 'downloading', movie_infos: movie_infos}
    ii. Sinon on renvoie {status: 'not found', movie_infos: ''} et on l'ajoute en BDD dans une table 'to_download'
*/
router.get('/movie_in_db', with_auth, async (req, res) => {
    if (req.query.movie_id && req.query.movie !== "") {
        let movie_infos_db = await films.film_db(req.query.movie_id);
        if (movie_infos_db == 'vide') {
            let movie_infos_api = await films.movie_infos(req.query.movie_id);
            // On prend les providers
            let torrent_infos = await torrents.ft_torrent(movie_infos_api/*, ['Rarbg', 'Torrentz2', 'ThePirateBay', 'KickassTorrents', 'TorrentProject']*/);
            res.status(201).send(torrent_infos);
        }
        else {
            //Si le telechargement est fini
            if (JSON.parse(movie_infos_db)[0].download_complete === 1)
            {
                res.status(200).send(movie_infos_db);
            }
            else // Si le telechargement est toujours en cours
            {
                res.status(206).send(movie_infos_db);
            }
        }
    }
});

/*
    Lorsque le telechargement est fini on l'indique en BDD
*/
router.post('/torrent_done', with_auth, (req, res) => {
    const magnet = req.body.body.split('magnet=')[1];
    if (magnet && magnet != "" && magnet != undefined) {
        films.torrent_done(magnet);
    }
})

module.exports = router;