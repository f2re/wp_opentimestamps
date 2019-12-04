
/* OpenTimestamps functions */

const OpenTimestamps = window.OpenTimestamps;

function stamp(filename, hash, hashType) {
	Document.progressStart();

	var op;
	if (hashType == "SHA1"){
		op = new OpenTimestamps.Ops.OpSHA1();
	}else if (hashType == "SHA256"){
		op = new OpenTimestamps.Ops.OpSHA256();
	}else if (hashType == "RIPEMD160"){
		op = new OpenTimestamps.Ops.OpRIPEMD160();
	} else {
		op = new OpenTimestamps.Ops.OpSHA256();
	}
	const detached = OpenTimestamps.DetachedTimestampFile.fromHash(op, hexToBytes(hash));

	OpenTimestamps.stamp(detached).then( ()=>{
		const ctx = new OpenTimestamps.Context.StreamSerialization();
		detached.serialize(ctx);
		const timestampBytes = ctx.getOutput();
		download(filename, timestampBytes);
		Document.progressStop();
        success(opentimestampsLangs['progress_success']);
		// success('Création du reçu OpenTimestamps et début du téléchargement');
	}).catch(err => {
		console.log("err "+err);
		Document.progressStop();
		failure("" + err);
	});
}

function upgrade_verify(ots, hash, hashType, filename) {
	// OpenTimestamps command
	var op;
	if (hashType == "SHA1"){
		op = new OpenTimestamps.Ops.OpSHA1();
	}else if (hashType == "SHA256"){
		op = new OpenTimestamps.Ops.OpSHA256();
	}else if (hashType == "RIPEMD160"){
		op = new OpenTimestamps.Ops.OpRIPEMD160();
	} else {
		op = new OpenTimestamps.Ops.OpSHA256();
	}
	const detached = OpenTimestamps.DetachedTimestampFile.fromHash(op, hexToBytes(hash));
	const detachedOts = OpenTimestamps.DetachedTimestampFile.deserialize(ots);

    Proof.progressStart();

    // OpenTimestamps upgrade command
    OpenTimestamps.upgrade(detachedOts).then( (changed)=>{
        const bytes = detachedOts.serializeToBytes();
    	if(changed){
        	//success('Timestamp has been successfully upgraded!');
        	download(filename, bytes);

        	// update proof
        	Proof.data = bin2String(bytes);
    	} else {
        	// File not changed: just upgraded
    	}
    	return OpenTimestamps.verify(detachedOts,detached)
    }).then( (results)=>{
        Proof.progressStop();

        if( Object.keys(results).length == 0 ){
        	// no attestation returned
			if (detachedOts.timestamp.isTimestampComplete()) {
                Proof.progressStop();
                // check attestations
                detachedOts.timestamp.allAttestations().forEach(attestation => {
                    if(attestation instanceof OpenTimestamps.Notary.UnknownAttestation){
                        warning(opentimestampsLangs['unknown_cert']);
                    	// warning('Type d\'attestation inconnu');
                	}
            	});
    		} else {
                warning(opentimestampsLangs['warning']);
                // warning('En attente d\'attestation');
			}
		} else {
			var text = "";
			Object.keys(results).map(chain => {
				var date = moment(results[chain].timestamp * 1000).tz(moment.tz.guess()).format('YYYY-MM-DD z')
                text += opentimestampsLangs['chain_replace'].replace( '%chain%',upperFirstLetter(chain) ).replace( '%height%', results[chain].height).replace('%date%', date);
                // text += upperFirstLetter(chain) + ' pâté de maisons ' + results[chain].height + ' atteste l\'existence au ' + date + '<br>';
    		});
        	success(text);
		}
	}).catch(err => {
        Proof.progressStop();
		failure(err.message);
	});
}


/* Hashes object to handle different hashes */

var Hashes = {
	init(){
        this.progress = true;
        this["SHA1"] = CryptoJS.algo.SHA1.create();
        this["SHA256"] = CryptoJS.algo.SHA256.create();
        this["RIPEMD160"] = CryptoJS.algo.RIPEMD160.create();
	},
	getSupportedTypes(){
		return ["SHA1","SHA256","RIPEMD160"];
	},
	update(type,msg){
        this.progress = true;
        this[type].update(msg);
	},
	get(type){
        this.progress = false;
        if(this[type] === undefined){
            return undefined;
        }
		if(typeof(this[type])=="string"){
			return this[type];
		}
        this[type] = this[type].finalize().toString();
		return this[type];
	},
	set(type, hash){
        this.progress = false;
        this[type] = hash;
	}
}


/* Document object to upload & parse document file */

var Document = {
	init : function (){
        this.tagId = undefined;
        this.filename = undefined;
        this.filesize = undefined;
        Hashes.init();
	},
    setTagId : function(tagId){
        this.tagId = tagId;
    },
    setFile : function(file,hashType){
        this.filename = file.name;
        this.filesize = file.size;
    },
    exist : function(){
        return this.filename !== undefined && this.filesize !== undefined;
    },
	upload : function (file) {

		// callbackRead function
		var lastOffset = 0;
        var previous = [];
        function callbackRead(reader, file, evt, callbackProgress, callbackFinal){

            if(lastOffset !== reader.offset){
                // out of order
                //console.log("[",reader.size,"]",reader.offset,'->', reader.offset+reader.size,">>buffer");
                previous.push({ offset: reader.offset, size: reader.size, result: reader.result});
                return;
            }

            function parseResult(offset, size, result) {
                lastOffset = offset + size;
                callbackProgress(result);
                if (offset + size >= file.size) {
                    lastOffset = 0;
                    callbackFinal();
                }
            }

            // in order
            //console.log("[",reader.size,"]",reader.offset,'->', reader.offset+reader.size,"");
            parseResult(reader.offset, reader.size, reader.result);

            // resolve previous buffered
            var buffered = [{}]
            while (buffered.length > 0) {
                buffered = previous.filter(function (item) {
                    return item.offset === lastOffset;
                });
                buffered.forEach(function (item) {
                    //console.log("[", item.size, "]", item.offset, '->', item.offset + item.size, "<<buffer");
                    parseResult(item.offset, item.size, item.result);
                    previous.remove(item);
                })
            }
        }

        // loading function
        function loading(file, callbackProgress, callbackFinal) {
            var chunkSize  = 1024*1024; // bytes
            var offset     = 0;
            var size=chunkSize;
            var partial;
            var index = 0;

            if(file.size===0){
                callbackFinal();
            }
            while (offset < file.size) {
                partial = file.slice(offset, offset+size);
                var reader = new FileReader;
                reader.size = chunkSize;
                reader.offset = offset;
                reader.index = index;
                reader.onload = function(evt) {
                    callbackRead(this, file, evt, callbackProgress, callbackFinal);
                };
                reader.readAsArrayBuffer(partial);
                offset += chunkSize;
                index += 1;
            }
        }


        // start upload
		var counter = 0;
		var self = this;

        Hashes.init();
		hashing('0%');

        loading(file,
			function (data) {
				var wordBuffer = CryptoJS.lib.WordArray.create(data);
                Hashes.update("SHA1",wordBuffer);
                Hashes.update("SHA256",wordBuffer);
                Hashes.update("RIPEMD160",wordBuffer);
				counter += data.byteLength;
				hashing((( counter / file.size)*100).toFixed(0) + '%');

			}, function (data) {
                hashing('100%');
                console.log('SHA1 '+Hashes.get("SHA1"));
                console.log('SHA256 '+Hashes.get("SHA256"));
                console.log('RIPEMD160 '+Hashes.get("RIPEMD160"));
                self.show();
                self.callback();
			});
	},
	show : function(){
		if(this.filename) {
			$(this.tagId+" .filename").html(this.filename);
		} else {
			$(this.tagId+" .filename").html("Unknown name");
		}
		if(this.filesize) {
			$(this.tagId+" .filesize").html(" " + humanFileSize(this.filesize, true));
		} else {
			$(this.tagId+" .filesize").html("&nbsp;");
		}

        var hashType = "SHA256";
        if (Proof.exist()) {
            hashType = Proof.getHashType().toUpperCase();
            if (!Hashes.getSupportedTypes().indexOf(hashType) === -1) {
                failure("Not supported hash type");
                return;
            }
        }
        if (!Hashes.getSupportedTypes().indexOf(hashType) === -1) {
            failure("Not supported hash type");
            return;
        }
        $(this.tagId+" .hash").html("");
        if (!Hashes.progress && Hashes.get(hashType)) {
            $(this.tagId+" .hash").html(hashType + ": " + Hashes.get(hashType));
        }
	},
	progressStart : function(){
		this.percent = 0;
		var self = this;
		this.interval = setInterval(() => {
			self.percent += parseInt(self.percent/3) + 1;
		if (self.percent > 100) {
			self.percent = 100;
		}
		stamping(self.percent + ' %', opentimestampsLangs['percent'])
		}, 100);
	},
	progressStop : function(){
		clearInterval(this.interval);
	},
	callback : function(){
		// Run automatically stamp or verify action
        if(Proof.exist()) {
            // Automatically verify
            run_verification();
        } else {
            // Automatically stamp
            run_stamping();
        }
	}
};

/* Proof object to upload & parse OTS file */

var Proof = {
    init : function(){
        this.tagId = undefined;
        this.data = undefined;
        this.filename = undefined;
        this.filesize = undefined;
    },
    isValid : function(fileName){
        const res = fileName.match(/\.[0-9a-z]+$/i);
		return res !== null && res.length > 0 && res[0] === ".ots";

    },
    setTagId : function(tagId){
        this.tagId = tagId;
    },
	setFile : function(file){
		this.data = undefined;
		this.filename = file.name;
		this.filesize = file.size;
	},
	setArray : function(buffer){
		this.data = buffer;
		this.filename = undefined;
		this.filesize = undefined;
	},
	exist : function(){
    	return this.filename !== undefined && this.filesize !== undefined && this.data !== undefined;
	},
	upload: function (file) {
		// Read and crypt the file
		var self = this;
		var reader = new FileReader();
		reader.onload = function (event) {
			var data = event.target.result;
			self.data = String(String(data));
			self.filename = file.name;
			self.filesize = file.size;
			self.show();
		};
		reader.readAsBinaryString(file);
	},
	show: function(tagId) {
		if (this.filename) {
			$(this.tagId+" .filename").html(this.filename);
		} else {
			$(this.tagId+" .filename").html( opentimestampsLangs['number']);
		}
		if (this.filesize) {
			$(this.tagId+" .filesize").html(" " + humanFileSize(this.filesize, true));
		} else {
			$(this.tagId+" .filesize").html(" " + humanFileSize(this.data.length, true));
		}

        if (Proof.data) {
            var hashType = Proof.getHashType().toUpperCase();
            if (!Hashes.getSupportedTypes().indexOf(hashType) === -1) {
                failure(opentimestampsLangs['hash_type_filure']);
                return;
            }
            var hash = Proof.getHash();
            $(this.tagId+" .hash").html( opentimestampsLangs['stamped'] + hashType + opentimestampsLangs['hash'] + hash);

            if (Document.exist()) {
                // Document just uploaded
                run_verification();
            } else {
                // Document not uploaded
                verifying(opentimestampsLangs['upload_original']);
            }
        }
	},
    getHashType : function (){
        const detachedOts = OpenTimestamps.DetachedTimestampFile.deserialize(string2Bin(this.data ));
        return detachedOts.fileHashOp._HASHLIB_NAME().toUpperCase();
    },
    getHash : function (){
        const detachedOts = OpenTimestamps.DetachedTimestampFile.deserialize(string2Bin(this.data ));
        return bytesToHex(detachedOts.fileDigest());
    },
    progressStart : function(){
        this.stopInterval = false;
		this.percent = 0;

		var self = this;
		this.interval = setInterval(() => {
				self.percent += parseInt(self.percent/3) + 1;
				if (self.percent > 100) {
					self.percent = 100;
				}
				if(self.stopInterval == false) {
                    verifying(self.percent + ' %', opentimestampsLangs['verify'])
                }
			}, 100);
	},
	progressStop : function(){
        this.stopInterval = true;
		clearInterval(this.interval);
	}
};

/*
* STARTUP FUNCTION
*/

(function () {
	// your page initialization code here
	// the DOM will be available here

	// Document/Proof upload on #opentimestamp_document box

	function document_holder_upload(f){
        if (f === undefined){
            return;
        }
        if (Proof.isValid(f.name)){
            Proof.init();
            Document.init();
            Proof.setFile(f);
            Proof.setTagId('#opentimestamp_document');
            Proof.show();
            Proof.upload(f);
            $('#opentimestamp_stamped').show();
            // $("#result_stamp").hide();
            // $("#result_verify").show();
        } else {
            Proof.init();
            Document.init();
            Document.setFile(f);
            Document.setTagId('#opentimestamp_document');
            Document.show();
            Document.upload(f);
            $('#opentimestamp_stamped').hide();
            // $("#result_stamp").hide();
            // $("#result_verify").hide();
        }
	}
	$('#opentimestamp_document').on('drop', function (event) {
		event.preventDefault();
		event.stopPropagation();
		$(this).removeClass('hover');
		var f = event.originalEvent.dataTransfer.files[0];
        document_holder_upload(f);
		return false;
	});
	$('#opentimestamp_document').on('dragover', function (event) {
		event.preventDefault();
		event.stopPropagation();
		$(this).addClass('hover');
		return false;
	});
	$('#opentimestamp_document').on('dragleave', function (event) {
		event.preventDefault();
		event.stopPropagation();
		$(this).removeClass('hover');
		return false;
	});
	$('#opentimestamp_document').click(function (event) {
		event.preventDefault();
		event.stopPropagation();
		document.getElementById('opentimestamp_input').click();
		return false;
	});
	$('#opentimestamp_input').change(function (event) {
		var f = event.target.files[0];
        document_holder_upload(f);
		return false;
	});

    // Document upload on #opentimestamp_stamped box

	function stamped_holder_upload(f){
        if (f === undefined){
            return;
        }
        Document.init()
        Document.setFile(f);
        Document.setTagId('#opentimestamp_stamped');
        Document.show();
        Document.upload(f);
	}
    $('#opentimestamp_stamped').on('drop', function (event) {
        event.preventDefault();
        event.stopPropagation();
        $(this).removeClass('hover');
        var f = event.originalEvent.dataTransfer.files[0];
        stamped_holder_upload(f);
        return false;
    });
    $('#opentimestamp_stamped').on('dragover', function (event) {
        event.preventDefault();
        event.stopPropagation();
        $(this).addClass('hover');
        return false;
    });
    $('#opentimestamp_stamped').on('dragleave', function (event) {
        event.preventDefault();
        event.stopPropagation();
        $(this).removeClass('hover');
        return false;
    });
    $('#opentimestamp_stamped').click(function (event) {
        event.preventDefault();
        event.stopPropagation();
        document.getElementById('opentimestamp_stamped_input').click();
        return false;
    });
    $('#opentimestamp_stamped_input').change(function (event) {
        event.preventDefault();
        var f = event.target.files[0];
        stamped_holder_upload(f);
        return false;
    });

    // Get info action on ots

    $("#statuses .statuses-info").click(function (event) {
        event.preventDefault();
        run_info();
        return false;
    });


	// Handle GET parameters
	const digest = getParameterByName('digest');
    const algorithm = getParameterByName('algorithm');
	if(digest) {
		Hashes.init();
		Hashes.set(digest, algorithm);
		Document.show();
	}
	const ots = getParameterByName('ots');
	if(ots) {
		Proof.setArray(hex2ascii(ots));
		Proof.show();
	}
	// autorun proof
	if(digest && ots){
        run_verification();
	}

})();

/* Runnable functions on gui to start processes */

function run_stamping(){
    const algorithm = getParameterByName('algorithm');
    var hashType = "SHA256";
    if (algorithm){
        hashType = algorithm.toUpperCase();
    }
    if (Hashes.get(hashType)) {
        stamp(Document.filename, Hashes.get(hashType), hashType);
    } else {
        failure(opentimestampsLangs['pour_stamp']);
    }
}

function run_verification(){
    if (Proof.data) {
        Proof.progressStart();

        var hashType = Proof.getHashType().toUpperCase();
        if (!Hashes.getSupportedTypes().indexOf(hashType) === -1) {
            failure(opentimestampsLangs['unsopported_type']);
            return;
        }
        if (!Hashes.get(hashType)){
            failure(opentimestampsLangs['no_files']);
            return;
        }
        Proof.upgraded = false;
        upgrade_verify(string2Bin(Proof.data), Hashes.get(hashType), hashType, Proof.filename);
    } else {
        failure(opentimestampsLangs['pour_verifer'])
    }
}

function run_info(){
    if (Proof.data) {
        location.href = "./info/?"+bytesToHex(string2Bin(Proof.data));
    } else {
        failure(opentimestampsLangs['poour_info'])
    }
}

/*
 * EXTENDS ARRAY
 */
Array.prototype.remove = Array.prototype.remove || function(val){
    var i = this.length;
    while(i--){
        if (this[i] === val){
            this.splice(i,1);
        }
    }
};

/*
 * COMMON FUNCTIONS
 */
// Human file size
function humanFileSize(bytes, si) {
	var thresh = si ? 1000 : 1024;
	if (Math.abs(bytes) < thresh) {
		return bytes + ' B';
	}
	var units = si
		? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
		: ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
	var u = -1;
	do {
		bytes /= thresh;
		++u;
	} while (Math.abs(bytes) >= thresh && u < units.length - 1);
	return bytes.toFixed(1) + ' ' + units[u];
}

// Download file
function download(filename, text) {
	var blob = new Blob([text], {type: "octet/stream"});

	saveAs(blob, filename + (Proof.isValid(filename) ? '' : '.ots') );
}

function string2Bin(str) {
	var result = [];
	for (var i = 0; i < str.length; i++) {
		result.push(str.charCodeAt(i));
	}
	return result;
}
function bin2String(array) {
	return String.fromCharCode.apply(String, array);
}

function ascii2hex(str) {
	var arr = [];
	for (var i = 0, l = str.length; i < l; i ++) {
		var hex = Number(str.charCodeAt(i)).toString(16);
		if (hex<0x10) {
			arr.push("0" + hex);
		} else {
			arr.push(hex);
		}
	}
	return arr.join('');
}

function hex2ascii(hexx) {
	var hex = hexx.toString();//force conversion
	var str = '';
	for (var i = 0; i < hex.length; i += 2)
		str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
	return str;
}

function bytesToHex (bytes) {
	const hex = [];
	for (var i = 0; i < bytes.length; i++) {
		hex.push((bytes[i] >>> 4).toString(16));
		hex.push((bytes[i] & 0xF).toString(16));
	}
	return hex.join('');
};

function hexToBytes(hex) {
	const bytes = [];
	for (var c = 0; c < hex.length; c += 2) {
		bytes.push(parseInt(hex.substr(c, 2), 16));
	}
	return bytes;
};

function upperFirstLetter(string){
	return string[0].toUpperCase() + string.substr(1);
}


// get parameters
function getParameterByName(name, url) {
	if (!url) {
		url = window.location.href;
	}
	name = name.replace(/[\[\]]/g, "\\$&");
	var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
		results = regex.exec(url);
	if (!results) return null;
	if (!results[2]) return '';
	return decodeURIComponent(results[2].replace(/\+/g, " "));
}


/*
 * STATUS ALERT MESSAGES
 */

function message(title, text, cssClass, showInfo){
	$('#statuses').attr('class','statuses alert '+cssClass);
    $('#statuses .statuses-title').html(title);
    $('#statuses .statuses-description').html(text);
    message_info(showInfo);
    $('#statuses').show();
}

function message_info(showInfo){
    if(showInfo != undefined && showInfo == true){
        $('#statuses .statuses-info').show();
    } else if(showInfo != undefined && showInfo == false){
        $('#statuses .statuses-info').hide();
    }
}

function verifying(text){
    message(opentimestampsLangs["msg_verify"], text, 'alert-info', true);
}
function stamping(text){
    message(opentimestampsLangs["msg_ench"], text, 'alert-info', false);
}
function hashing(text){
    message(opentimestampsLangs["msg_hashing"], text, 'alert-info', false);
}
function success(text){
    message(opentimestampsLangs["msg_suc"], text, 'alert-success');
}
function failure(text){
    message(opentimestampsLangs["msg_no"], text, 'alert-danger');
}
function warning(text){
    message(opentimestampsLangs["msg_warn"], text, 'alert-warning');
}
