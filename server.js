var connect = require('connect'),
	crypto = require('crypto'),
	fs = require('fs'),
	util = require('utils'),
	path = require('path'),
	exec = require('child_process').exec,
	form = require('connect-form');

var hashAlgo = "md5",
	fileQueue = new Array(),
	regex = /(..)(..)(..)(..).*/,
	doc_root = "./media/";

function moveFile(oldPath, newPath){
	fs.rename(oldPath, newPath, function(err){
		if(err){
			console.log("Move Error: " + err);

			// backup plan
			var is = fs.createReadStream(oldPath)
			var os = fs.createWriteStream(newPath);

			util.pump(is, os, function() {
			    fs.unlinkSync(oldPath);
			});
		}
	});
}

function putKeyValue(key, value){
	console.log("Key: " + key);
	console.log("Value: " + value);
}

function FileStat(){
}

FileStat.prototype = {
	checkSum: function(callback){
		var hash, matches,
			hashData = "" + this.mtime + this.size + this.path;
		if(this.path && this.mtime && this.size){
			hash = crypto.createHash(hashAlgo).update(hashData).digest("hex");

			matches = this.qmd5 ? (this.qmd5 == hash) : true;
			
			callback(matches, hash);
		}
	}
};

function saveFile(filePath, md5sum, callback){
	var readStream,
		hash = crypto.createHash(hashAlgo);

	// if this method was called without the second parameter
	if(!callback && 'function' == typeof md5sum){
		callback = md5sum;
		md5sum = undefined;
	}
	
	readStream = fs.createReadStream(filePath);

	readStream.on('data', function(data){
		hash.update(data);
	});

	readStream.on('error', function(err){
		console.log("Read Error: " + err.toString());
		readStream.destroy();
		fs.unlink(filePath);
		throw err;
	});

	readStream.on('end', function(){
		var hashVal = hash.digest("hex"), m, newPath;

		// if we have a md5sum and they don't match, abandon ship
		if(md5sum && md5sum != hashVal){
			// we don't care about the callback
			fs.unlink(filePath);
			callback(false);
		}else{
			m = hashVal.match(regex);
			newPath = path.join(doc_root, m[1], m[2], m[3], m[4]);

			path.exists(newPath, function(exists){
				var tJoin = path.join(newPath, m[0]);

				if(!exists){
					exec('mkdir -p ' + newPath, function(err, stdout, stderr){
						console.log("Err: " + (err ? err : "none"));
						console.log("stdout: " + (stdout ? stdout : "none"));
						console.log("stderr: " + (stderr ? stderr : "none"));
						moveFile(filePath, tJoin);
					});
				}else{
					moveFile(filePath, tJoin);
				}
			});
			callback(true, newPath);
		}
	});
}

function handleUpload(req, res, next){
	var tFileStat;
	if(req.form){
		req.form.complete(function(err, fields, files){
			fields.stats = JSON.parse(fields.stats);
			fields.statsHeader = JSON.parse(fields.statsHeader);
			fields.stats.forEach(function(item, index, thisArray){
				tFileStat = new FileStat();

				item.forEach(function(field, index, thisArray){
					tFileStat[fields.statsHeader[index]] = field;
				});

				tFileStat.checkSum(function(equal, hash){
					var oldPath;
					if(equal){
						oldPath = files[hash].path;
						saveFile(oldPath, this.md5, function(success, path){
							if(success){
								putKeyValue(hash, path);
							}
						});
					}
				});
			});
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.end("Files processed");
		});
	}else{
		next();
	}
}

var server = connect.createServer(
	form({keepExtensions: true}),
	handleUpload,
	connect.staticProvider()
);

server.listen(8022);

console.log("Server listening on port 8022");
