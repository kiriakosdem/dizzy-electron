class Piston{


constructor() {
	this.width = 100;
	this.height = fullscreenheight;
	this.x = 100;
	this.y = fullscreenheight/2;
	this.speedx = 0;
	this.speedy = 0;
	this.red = 255;
	this.green = 255;
	this.blue = 255;
}
	
move() {
 	this.x += this.speedx;
	this.y += this.speedy;
}

	
show() {
	rectMode(CENTER);
	
	noStroke();
	fill(60);
	rect(this.x, this.y, this.width, this.height);
	
	strokeWeight(4);
	stroke(200);
	point(this.x,this.y);
}


wallcolission() {
	//right wall
	if (this.x > 300 - this.width/2) {
  		this.x = 300 - this.width/2;
  		this.speedx *= -1;
	}
	//left wall
	if (this.x < 0+this.width/2) {
		this.x = 0+this.width/2;
  		this.speedx *= -1;
	}
}

	
}