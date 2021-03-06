About
=====

Node-filesync is a file synchronization system utilizing NodeJS in both the client and server.


Client
------

The client communicates with the server through a websocket and pulls updates from the server when necessary. The various components are:

* Watched files database
    * Implemented with PostgreSQL
	* Updated on filesystem events (inotify or similar)
	* Used in periodic sync checks
	* Keys are hashes based on the filepath, timestamp and size
	* Values are filepaths
	* Keys are reverse searchable as well
* HTTP client
    * Pushes changed files to the server
	* Pulls changed files from the server
	* Stores files to be uploaded in a priority queue
	* Stores files to be downloaded in a priority queue
	* Opens websocket with server (server notifies all clients of file changes)


Server
------

The server communicates changes through open websockets with clients and serves file upload and download requests. The particur components are as follows:

* File database- implemented with CouchDB
    * Key- md5 hash of file
	* Value- owners, file data, and location of file on server
* Files stored on disk according to md5 sum
    * Directory structure determined by md5 sum
	* Filename is md5 sum
* HTTP server
    * Opens websockets with each client and pushes file change notifications
	* Responds to file download requests
	* Responds to file upload requests
	* Responds to watched file data requests (all files watched)


State of the project:
=====================

This is a work in progress and in pre-alpha stage.  These features are implemented and seem to work:

* File downloads (not thoroughly tested)
* File uploads in node
* Listening to filesystem events given a parent directory using inotify
* Hashing on server and client
* Directory structure on server
* Server database backend to track uploaded files
* Client database to track file synchronization with server
