'use strict';
class Visibility{
 constructor(){this.manual=false;this.hover=false;this.edge=false;this.idle=true;}
 hide(){this.manual=true;this.hover=false;this.edge=true;this.idle=true;}
 reveal(explicit=true){if(this.manual&&!explicit)return false;this.manual=false;this.idle=false;return true;}
 update({active,expanded,edge,hover,card}){if(edge&&!this.edge)this.reveal();this.edge=edge;this.hover=hover;this.idle=this.manual||!expanded&&!active&&!hover&&!card&&!edge;return this.idle;}
}
module.exports={Visibility};
