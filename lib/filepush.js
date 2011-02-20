(function () {
  "use strict";

  var http = require('http'),
    fs = require('fs'),
    FileApi = require('file-api'),
    File = require('file-api').File,
    FormData = require('file-api').FormData;

  function create(host, port, stats, cb) {
    var formData = new FormData(),
      chunked = false,
      //chunked = true,
      client = http.createClient(port, host);

    function encodeBody(stats) {
      var qstats = [];

      formData.setNodeChunkedEncoding(chunked);
      formData.append('statsHeader', JSON.stringify(["path","mtime","size","qmd5"]));

      stats.forEach(function (stat) {
        var crypto = require('crypto'),
          path = stat.path,
          mtime = stat.mtime.valueOf(),
          size = stat.size,
          qmd5 = crypto.createHash("md5").update("" + mtime + size + path).digest("hex");

        console.log(qmd5, "" + mtime, size, path);
        qstats.push([path, mtime, size, qmd5]);
      });
      formData.append('stats', JSON.stringify(qstats));

      // TODO this would fail if nothing were present
      qstats.forEach(function (qstat, i) {
        formData.append(qstat[3], new File(stats[i]));
      });
    }

    function sendBody() {
      // Uses 'x-www-form-urlencoded' if possible, but falls back to 'multipart/form-data; boundary=`randomString()`'
      var bodyStream = formData.serialize('x-www-form-urlencoded'),
        headers = {
          "Host": "localhost:3000",
          "User-Agent": "Node.js (AbstractHttpRequest)",
          "Accept-Encoding": "gzip,deflate",
          "Content-Type": formData.getContentType(),
          //"Accept-Charset": "ISO-8859-1,utf-8;q=0.7,*;q=0.7",
          //"Keep-Alive": 115,
          //"Connection": "keep-alive",
        },
        request;

      if (chunked) {
        request = client.request('POST', '/', headers);
        bodyStream.on('data', function (data) {
          request.write(data);
        });
      }

      // `data` will usually fire first, then `size`, then more `data`, then `load`
      bodyStream.on('size', function (size) {
        if (!chunked) {
          headers["Content-Length"] = size;
          request = client.request('POST', '/', headers);
        }
        request.on('response', function (response) {
          response.on('data', function (data) {
            console.log(data.toString());
          });
        });
      });

      bodyStream.on('load', function (data) {
        if (!chunked) {
          request.write(data);
        }
        request.end();
        cb();
      });

    }

    encodeBody(stats);
    sendBody();
  }

  module.exports = create;
}());