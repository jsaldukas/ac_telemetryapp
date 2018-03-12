var LapAnalysisCanvas = function (options) {
	if(!options) throw 'LapAnalysisCanvas: op1tions parameter must be specified';
	if(!options.canvas) throw 'LapAnalysisCanvas: options.canvas parameter must be specified';
	if(!options.laps) throw 'LapAnalysisCanvas: options.laps parameter must be specified';
	if(!options.laps.length) throw 'LapAnalysisCanvas: options.laps must be an array of lap data';
	if(!options.laps[0].length) throw 'LapAnalysisCanvas: options.laps must be an array of lap data';
	
	var canvas = canvas: $(options.canvas)[0];
	if(!canvas) throw 'LapAnalysisCanvas: canvas not found';
	
	var totalLapsExtent = calculateLapsExtent(options.laps);
	
	var instance = {
		options,
		canvas
	};
	
	var coordTransform = getLapToCanvasCoordTransform([lapData1, lapData2], width, height);
	
	lapsContext.coordTransform = coordTransform;
	lapsContext.canvasWidth = width;
	lapsContext.canvasHeight = height;
	lapsContext.canvas = myCanvas;
	
	console.log('laps loaded');

	startLapAnimation();
	
	function buildCoordinateTransformer(totalLapsExtent) {
		return {
			getx: function (lap_pos_x) {
				
			},
			gety: function (lap_pos_z) {
				
			}
		};
	}
	
	function calculateLapsExtent(laps) {
		var minX = 999999, maxX = -999999, minZ = 999999, maxZ = -999999;
		for(var lapIndex = 0; lapIndex < laps.length; lapIndex++) {
			var lapData = laps[lapIndex];
			for(var i = 0; i < lapData.length; i++) {
				var lapFrame = lapData[i];
				if(lapFrame.pos_x < minX) minX = lapFrame.pos_x;
				if(lapFrame.pos_x > maxX) maxX = lapFrame.pos_x;
				if(lapFrame.pos_z < minZ) minZ = lapFrame.pos_z;
				if(lapFrame.pos_z > maxZ) maxZ = lapFrame.pos_z;
			}
		}
		
		return {
			minX: minX,
			maxZ: maxZ,
			maxX: maxX,
			minZ: minZ
		};
	}

	function getLapToCanvasCoordTransform(lapDataList, canvasWidth, canvasHeight) {
		var minScale = 999999;
		var minOffsetX = 999999;
		var minOffsetZ = 999999;
		var canvasSize = canvasHeight > canvasWidth ? canvasWidth : canvasHeight;
		for(var i = 0; i < lapDataList.length; i++) {
			var lapData = lapDataList[i];
			var lapRect = calculateLapRect(lapData);
			var scaleX = canvasSize / (lapRect.maxX - lapRect.minX);
			var scaleZ = canvasSize / (lapRect.maxZ - lapRect.minZ);
			var scale = scaleX > scaleZ ? scaleZ : scaleX;
			var offsetX = -lapRect.minX;
			var offsetZ = -lapRect.minZ;
			
			if(scale < minScale) minScale = scale;
			if(offsetX < minOffsetX) minOffsetX = offsetX;
			if(offsetZ < minOffsetZ) minOffsetZ = offsetZ;
		}
		
		return {
			scale: minScale,
			offsetX: minOffsetX,
			offsetZ: minOffsetZ
		};
	}
	
	return {
		
	};
};

function loadLapData(url) {
	// car_id,pos_x,pos_y,pos_z,velocity_x,velocity_y,velocity_z,gear,engine_rpm,normalized_spline_pos
	return $.ajax({
		url: url,
		method: 'GET'
	}).then(function (data) {
		var rows = data.split("\r\n");
		var lapFrames = [];
		var header = rows[0].split(',');
		var lapTimeMs = 0;
		for(var i = 1; i < rows.length; i++) {
			var cols = rows[i].split(',');
			if(cols.length <= 1)
				continue;
			var lapFrame = {};
			for(var j = 0; j < cols.length; j++) {
				var value = cols[j];
				var floatValue = parseFloat(value);
				if(!isNaN(floatValue))
					value = floatValue;
				lapFrame[header[j]] = value;
			}
			lapFrame.lap_time_ms = lapTimeMs;
			lapFrames.push(lapFrame);
			
			lapTimeMs += 100;
		}
		return lapFrames;
	});
}

function setLapCanvasCoordinates(lapData, canvasSize) {
	var lapRect = calculateLapRect(lapData);
	var scaleX = canvasSize / (lapRect.maxX - lapRect.minX);
	var scaleZ = canvasSize / (lapRect.maxZ - lapRect.minZ);
	var scale = scaleX > scaleZ ? scaleZ : scaleX;
	var offsetX = -lapRect.minX;
	var offsetZ = -lapRect.minZ;
	for(var i = 0; i < lapData.length; i++) {
		var lapFrame = lapData[i];
		lapFrame.canvas_x = (lapFrame.pos_x + offsetX) * scale;
		lapFrame.canvas_y = (lapFrame.pos_z + offsetZ) * scale;
	}
}

function drawLapPointers(ctx, lapFrame, coordTransform, color) {
	function getCanvasX(pos_x, coordTransform) {
		return (coordTransform.offsetX + pos_x) * coordTransform.scale;
	}
	function getCanvasY(pos_z, coordTransform) {
		return (coordTransform.offsetZ + pos_z) * coordTransform.scale;
	}
	
	ctx.save();
	
	ctx.beginPath();
	
	var canvasX = getCanvasX(lapFrame.pos_x, coordTransform);
	var canvasY = getCanvasY(lapFrame.pos_z, coordTransform);
		
	ctx.arc(canvasX, canvasY, 15, 0, 2*Math.PI);
	ctx.fillStyle = color;
	ctx.fill();
	
	ctx.restore();
}

function drawLap(ctx, lapData, coordTransform, color) {
	function getCanvasX(pos_x, coordTransform) {
		return (coordTransform.offsetX + pos_x) * coordTransform.scale;
	}
	function getCanvasY(pos_z, coordTransform) {
		return (coordTransform.offsetZ + pos_z) * coordTransform.scale;
	}
	
	ctx.beginPath();
	
	if(color) {
		ctx.strokeStyle = color;
	}
	
	ctx.lineWidth = 1;
	
	ctx.moveTo(getCanvasX(lapData[0].pos_x, coordTransform), getCanvasY(lapData[0].pos_z, coordTransform));
	
	for(var i = 0; i < lapData.length; i++) {
		var canvasX = getCanvasX(lapData[i].pos_x, coordTransform);
		var canvasY = getCanvasY(lapData[i].pos_z, coordTransform);
		ctx.lineTo(canvasX, canvasY);
	}
	
	ctx.closePath();
	ctx.stroke();
	
	ctx.restore();
}

function drawLaps(ctx) {
	var colors = ['grey', 'red', 'green'];
	var coordTransform = lapsContext.coordTransform;
	
	for(var i = 0; i < laps.length; i++) {
		var color = colors[i % colors.length];
		drawLap(ctx, laps[i].data, coordTransform, color);
		
		if(lapsAnimateContext && lapsAnimateContext.lapsFramePointers) {
			var currentLapFrame = laps[i].data[lapsAnimateContext.lapsFramePointers[i]];
			drawLapPointers(ctx, currentLapFrame, coordTransform, color);
		}
	}
}

var laps = [];
var lapsContext = {};
var lapsAnimateContext = {};

function loadLapComparison(lapUrl1, lapUrl2) {
	loadLapData(lapUrl1).then(function (lapData1) {
		loadLapData(lapUrl2).then(function (lapData2) {
			laps.push({
				data: lapData1
			});
			laps.push({
				data: lapData2
			});
			
			var myCanvas = $('#myCanvas')[0]; 
			var width = myCanvas.width;
			var height = myCanvas.height;
			var coordTransform = getLapToCanvasCoordTransform([lapData1, lapData2], width, height);
			
			lapsContext.coordTransform = coordTransform;
			lapsContext.canvasWidth = width;
			lapsContext.canvasHeight = height;
			lapsContext.canvas = myCanvas;
			console.log('laps loaded');
			
			startLapAnimation();
			// window.requestAnimationFrame(function () {
				// var ctx = myCanvas.getContext('2d');
				// ctx.clearRect(0, 0, width, height);
				// drawLap(ctx, lapData1, coordTransform, 'grey');
				// drawLap(ctx, lapData2, coordTransform, 'red');
			// });
		});
	});
}



function startLapAnimation() {
	lapsAnimateContext = {};
	lapsAnimateContext.currentTimeMs = 0;
	lapsAnimateContext.lapsFramePointers = [];
	lapsAnimateContext.startTimeMs = getTime();
	lapsAnimateContext.isLapFinished = [];
	
	laps.forEach(function () { 
		lapsAnimateContext.lapsFramePointers.push(0); 
		lapsAnimateContext.isLapFinished.push(false);
	});
	
	function frame() {
		var ctx = lapsContext.canvas.getContext('2d');
		ctx.clearRect(0, 0, lapsContext.canvasWidth, lapsContext.canvasHeight);
		updateLapAnimation();
		drawLaps(ctx);
		
		lapsAnimateContext.requestAnimationFrame = window.requestAnimationFrame(frame);
	}
	
	lapsAnimateContext.requestAnimationFrame = window.requestAnimationFrame(frame);
	console.log('animation started');
}

function endLapAnimation() {
	window.cancelAnimationFrame(lapsAnimateContext.requestAnimationFrame);
	console.log('animation ended');
}

function updateLapAnimation(time) {
	var currentTimeMs = getTime() - lapsAnimateContext.startTimeMs;
	lapsAnimateContext.currentTimeMs = currentTimeMs;
	
	for(var lapIndex = 0; lapIndex < laps.length; lapIndex++) {
		if(lapsAnimateContext.isLapFinished[lapIndex])
			continue;
		
		var framePtr = lapsAnimateContext.lapsFramePointers[lapIndex];
		while(laps[lapIndex].data[framePtr].lap_time_ms < lapsAnimateContext.currentTimeMs) {
			framePtr++;
			if(framePtr >= laps[lapIndex].data.length) {
				lapsAnimateContext.isLapFinished[lapIndex] = true;
				framePtr--;
				break;
			}
		}
		
		lapsAnimateContext.lapsFramePointers[lapIndex] = framePtr;
	}
	
	// if all laps finished then reset
	if(lapsAnimateContext.isLapFinished.indexOf(false) === -1) {
		endLapAnimation();
		startLapAnimation();
		console.log('animation restarted');
	}
}


loadLapComparison('laps/01.29.538_18.csv', 'laps/01.30.094_18.csv');

// loadLapData('laps/01.29.538_18.csv').then(function (lapData) {
	// setLapCanvasCoordinates(lapData, 300, 300);
	// drawLap(lapData);
// });

// loadLapData('laps/01.29.538_18.csv').then(function (lapData) {
	// setLapCanvasCoordinates(lapData, 300, 300);
	// drawLap(lapData);
// });