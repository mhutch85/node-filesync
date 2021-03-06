(function () {
  "use strict";

  var http = require('http'),
    fs = require('fs'),
    path = require('path'),
    FileApi = require('file-api'),
    File = require('file-api').File,
    FormData = require('file-api').FormData,
    crypto = require('crypto');

  function dbStat2FileApiStat(dbStat) {
    // Blob: size, type
    // File: name, lastModifiedDate
    // node-file-api: path 
    dbStat.size = dbStat.size;
    dbStat.type = dbStat.type;
    dbStat.name = dbStat.basename + (dbStat.ext ? '.' + dbStat.ext : '');
    dbStat.lastModifiedDate = new Date(dbStat.mtime);
    dbStat.path = path.join(dbStat.rpath.reverse(), dbStat.name);
    //console.log(dbStat);
    return dbStat;
  }

  function create(options, stats, cb) {
    var formData = new FormData(),
      //chunked = false,
      chunked = true,
      auth,
      client;

    if (options.user && options.password) {
      auth = options.user + ':' + options.password;
    }

    client = http.createClient(options.port, options.host);

    function encodeBody(rstats) {
      var qstats = [];

      rstats.forEach(function (rstat, i) {
        rstats[i] = dbStat2FileApiStat(rstat);
      });

      formData.setNodeChunkedEncoding(chunked);
      formData.append('statsHeader', JSON.stringify(["path","mtime","size","qmd5"]));

      rstats.forEach(function (stat) {
        var gstat = [
          stat.path,
          stat.mtime.valueOf(),
          stat.size,
          crypto.createHash("md5").update("" + stat.mtime.valueOf() + stat.size + stat.path).digest("hex")
        ];

        console.log('gstat');
        console.log(gstat);
        qstats.push(gstat);
      });
      formData.append('stats', JSON.stringify(qstats));

      // TODO this would fail if nothing were present
      qstats.forEach(function (qstat, i) {
        formData.append(qstat[3], new File(rstats[i]));
      });
    }

    function sendBody() {
      // Uses 'x-www-form-urlencoded' if possible, but falls back to 'multipart/form-data; boundary=`randomString()`'
      var bodyStream = formData.serialize('x-www-form-urlencoded'),
        headers = {
          "Host": options.host + ':' + options.port,
          "User-Agent": "Node.js (AbstractHttpRequest)",
          "Accept-Encoding": "gzip,deflate",
          "Content-Type": formData.getContentType(),
          //"Accept-Charset": "ISO-8859-1,utf-8;q=0.7,*;q=0.7",
          //"Keep-Alive": 115,
          //"Connection": "keep-alive",
        },
        request;

      if (auth) {
        headers['authorization'] = 'Basic ' + (new Buffer(auth, 'utf8')).toString('base64');
      }

      if (chunked) {
        request = client.request('POST', '/', headers);
        console.log('############ made request');
        bodyStream.on('data', function (data) {
          request.write(data);
        });
      }

      // `data` will usually fire first, then `size`, then more `data`, then `load`
      bodyStream.on('size', function (size) {
        if (!chunked) {
          headers["Content-Length"] = size;
          request = client.request('POST', '/', headers);
          console.log('############ made request (not chunked)');
        }
        request.on('error', function (err) {
          cb(err);
        });
        request.on('response', function (response) {
          cb(null, response);
        });
      });

      bodyStream.on('load', function (data) {
        if (!chunked) {
          request.write(data);
        }
        request.end();
      });

    }

    encodeBody(stats);
    sendBody();
  }

  module.exports = create;
}());
