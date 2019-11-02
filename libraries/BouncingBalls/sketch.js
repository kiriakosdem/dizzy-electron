let poolballimag;
let piston;
let balls = [];
let Nparticles = 50;
//let fullscreenwidth = 1366;
//let fullscreenheight = 657;
let fullscreenwidth = $("#jscode").width();
let fullscreenheight = $("#jscode").height();
let minX = 0;



function setup() {
	var mycanvas = createCanvas(fullscreenwidth, fullscreenheight);
	mycanvas.parent("jscode");
	//var firstButton = createButton("Yeah Men!")
	//piston = new Piston();
	for (ip=0; ip<Nparticles; ip++){
		//minX= piston.x+piston.width/2;
		balls.push(new BilliardBall(random(minX,fullscreenwidth),random(0,fullscreenheight)));
	}
}



function draw() {
	background(230, 230, 230);

	for (var ind = 0; ind < balls.length; ind++) {
		// draw shapes
		//piston.show();
		balls[ind].show();

		// motion
		//piston.move();
		balls[ind].move();

		// check for colissions
		//piston.wallcolission();
		balls[ind].wallcolission();
		//balls[ind].pistoncolission(piston);
		for (let indother = 0; indother < ind; indother++) {
			balls[ind].ballcolission(balls[indother])
		}

		// other forces
		//balls[ind].gravity();
		//balls[ind].friction();

		// interactivity
		//balls[ind].rollover(mouseX,mouseY);
	}
}

//function mouseDragged() {
//    balls.push(new BilliardBall(mouseX, mouseY));
//}


function mousePressed() {
	let selection = false;
	let selectionindex = 0;

	if (mouseX>=0 && mouseX<=fullscreenwidth && mouseY>=0 && mouseY<=fullscreenheight){
		//check where the click was
		for (ind = 0; ind < balls.length; ind++) {
			if (balls[ind].selected(mouseX, mouseY)) {
				selection = true;
				selectionindex = ind;
			}
		}

		//if you click on ball remove it, otherwise create new
		if (selection == true) {
			balls.splice(selectionindex, 1);
		}else {
			balls.push(new BilliardBall(mouseX, mouseY));
		}
	}

}