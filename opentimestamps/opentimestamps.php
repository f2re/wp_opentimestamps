<?php
/**
 * Plugin Name: Opentimestamps plugin
 * Plugin URI: https://github.com/f2re/wp_opentimestamps
 * Description: Plugin for add shortcode to upload opentimestamps files and verify it.
 * Version: 0.1
 * Author: f2re
 * Author URI: https://github.com/f2re/
 * License: GPL2
 */
 
/*  Copyright 2019  F2RE  (email : lendingad@gmail.com)
    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License, version 2, as 
    published by the Free Software Foundation.
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*/
// Start writing code after this line!

// First we register our resources using the init hook
function opentimestamps_register_resources() {
  wp_register_script("opentimestamps-application-script", plugins_url("js/application.js", __FILE__), array(), "1", false);
  wp_register_script("opentimestamps-moment-script", plugins_url("js/moment.min.js", __FILE__), array(), "1", false);
  wp_register_script("opentimestamps-moment-timezone-script", plugins_url("js/moment-timezone-with-data-2012-2022.min.js", __FILE__), array(), "1", false);
  wp_register_script("opentimestamps-main-script", plugins_url("js/opentimestamps.min.js", __FILE__), array(), "0.4.4", false);
  wp_register_script("opentimestamps-crypto-script", plugins_url("js/crypto-js.js", __FILE__), array(), "1", false);
  wp_register_script("opentimestamps-index", plugins_url("js/index.js", __FILE__), array(), "1.0", false);
  wp_register_script("opentimestamps-script", plugins_url("js/app.js", __FILE__), array(), "1.0", false);
  wp_register_style("opentimestamps-style", plugins_url("css/main.css", __FILE__), array(), "1.0", "all");
  
  // wp_register_script("font-awesome-js", "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.11.2/js/all.min.js", array(), "1", false);
  // wp_register_style("font-awesome-css", "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.11.2/css/all.min.css", array(), "1.0", "all");


}
add_action( 'init', 'opentimestamps_register_resources' );

/**
 * Main function of shortcode
 *  
 */
function opentimestamps_shortcode($atts){
  // register script and styles
  wp_enqueue_script("opentimestamps-application-script");
  wp_enqueue_script("opentimestamps-moment-script");
  wp_enqueue_script("opentimestamps-moment-timezone-script");
  wp_enqueue_script("opentimestamps-main-script");
  wp_enqueue_script("opentimestamps-crypto-script");
  wp_enqueue_script("opentimestamps-index");
  wp_enqueue_script("opentimestamps-script");
  wp_enqueue_style("opentimestamps-style");

  // wp_enqueue_script("font-awesome-js");
  // wp_enqueue_style("font-awesome-css");

  $content = '<div class="opentimestamp-plugin" id="opentimestamp-plugin"> 
                <div class="drop-zone" id="opentimestamp_document">
                  <span class="filename"></span>
                  <span class="filesize"></span>
                  <p class="hash">
                    <i class="fas fa-upload"></i><br>
                    Déposez ici un fichier à <b>tamponner</b><br>
                    OU<br>
                    un fichier de preuve <i>.ots</i> pour <b>vérifier</b>
                  </p>
                </div>
                <input id="opentimestamp_input" type="file" style="display:none">
                <div class="drop-zone verify" id="opentimestamp_stamped" style="display:none">
                  <span class="filename"></span>
                  <span class="filesize"></span>
                  <p class="hash">
                    <br>Déposez ici le fichier tamponné
                  </p>
                </div>
                <input id="opentimestamp_stamped_input" type="file" style="display:none">
                
                <div class="statuses-container ">
                  <div class="statuses statuses_hashing alert alert-warning" id="statuses" style="display: none">
                    <a href="#" class="statuses-info" style="display: none"></a>
                    <h4 class="statuses-title alert-heading">52%</h4>
                    <hr>
                    <p class="statuses-description">
                      Hashing
                    </p>
                  </div>
                </div>
              </div>';

  return $content;
}

add_shortcode('opentimestamps-plugin', 'opentimestamps_shortcode');