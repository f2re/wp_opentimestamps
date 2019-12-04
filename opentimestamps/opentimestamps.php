<?php
/**
 * Plugin Name: Opentimestamps plugin
 * Plugin URI: https://github.com/f2re/wp_opentimestamps
 * Description: Plugin for add shortcode to upload opentimestamps files and verify it.
 * Version: 0.3
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

/**
 * generate language variable to translate all things 
 * @param  string $lang [description]
 * @return [type]       [description]
 */
function lang_variables( $lang='fr' ){
  $_langs = [ 
    // dont delete fr language
    // to add language - add new assoc element on array
    'fr' => [
      // text on html
      'select_to_upload' => 'Déposez ici un fichier à <b>tamponner</b><br>OU<br>un fichier de preuve <i>.ots</i> pour <b>vérifier</b>',
      'bufer_file'       => 'Déposez ici le fichier tamponné',
      // text on JS
      'progress_success' => 'Création du reçu OpenTimestamps et début du téléchargement',
      'unknown_cert'     => 'Type d\'attestation inconnu',
      'warning'          => 'En attente d\'attestation',
      'chain_replace'    => ' %chain% pâté de maisons %height% atteste l\'existence au %date% <br>',
      'percent'          => 'Estampage',
      'number'           => 'Nom inconnu',
      'hash_type_filure' => 'Type de hachage non supporté',
      'stamped'          => 'Stamped ',
      'hash'             => ' hash: ',
      'upload_original'  => 'Télécharger les données originales estampillées pour vérifier',
      'verify'           => 'Verify',
      'pour_stamp'       => 'Pour <strong>stamp</strong>vous devez déposer un fichier dans le champ Données',
      'unsopported_type' => 'Type de hachage non supporté',
      'no_files'         => 'Aucun fichier à vérifier ; téléchargez un fichier d\'abord',
      'pour_verifer'     => 'Pour <strong>vérifier</strong>vous devez déposer un fichier dans le champ Data et un <strong>.ots</strong> réception dans le champ OpenTimestamps proof.',
      'poour_info'       => 'Pour <strong>info</strong> vous devez déposer un fichier dans le champ Data et un <strong>.ots</strong> réception dans le champ OpenTimestamps proof.',
      'msg_verify'       => 'VÉRIFIER',
      'msg_ench'         => 'ÉCHANTILLONNAGE',
      'msg_hashing'      => 'HASHING',
      'msg_suc'          => 'SUCCÈS!',
      'msg_no'           => 'ÉCHEC!',
      'msg_warn'         => 'AVERTISSEMENT!',
    ],
    'en' =>[
      // text on html
      'select_to_upload' => '',
      'bufer_file'       => '',
      // text on JS
      'progress_success' => '',
      'unknown_cert'     => '',
      'warning'          => '',
      'chain_replace'    => '',
      'percent'          => '',
      'number'           => '',
      'hash_type_filure' => '',
      'stamped'          => '',
      'hash'             => '',
      'upload_original'  => '',
      'verify'           => '',
      'pour_stamp'       => '',
      'unsopported_type' => '',
      'no_files'         => '',
      'pour_verifer'     => '',
      'poour_info'       => '',
      'msg_verify'       => '',
      'msg_ench'         => '',
      'msg_hashing'      => '',
      'msg_suc'          => '',
      'msg_no'           => '',
      'msg_warn'         => '',
    ]
  ];

  if (isset( $_langs[$lang] )){
    return $_langs[$lang];
  }
  return $_langs['fr'];
}

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

  $lang = lang_variables('fr');

  // language script
  $langscript = "<script> var opentimestampsLangs = ".json_encode($lang)." </script>";

  // upload content
  $content = '<div class="opentimestamp-plugin" id="opentimestamp-plugin"> 
                <div class="drop-zone" id="opentimestamp_document">
                  <span class="filename"></span>
                  <span class="filesize"></span>
                  <p class="hash">
                    <i class="fas fa-upload"></i><br>
                    '.$lang['select_to_upload'].'
                  </p>
                </div>
                <input id="opentimestamp_input" type="file" style="display:none">
                <div class="drop-zone verify" id="opentimestamp_stamped" style="display:none">
                  <span class="filename"></span>
                  <span class="filesize"></span>
                  <p class="hash">
                    <br>'.$lang['bufer_file'].'
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

  return  $langscript.$content;
}

add_shortcode('opentimestamps-plugin', 'opentimestamps_shortcode');