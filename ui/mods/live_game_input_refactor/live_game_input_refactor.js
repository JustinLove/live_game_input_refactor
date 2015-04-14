(function() {
  var self = model

  var getSelectOption = function(event) {
    if (event.shiftKey)
    {
      if (event.ctrlKey)
        return 'remove';
      else
        return 'add';
    }
    else if (event.ctrlKey)
      return 'toggle';
    else
      return '';
  };

  self.beginFabDown = function(holodeck, mdevent) {
    var queue = mdevent.shiftKey;
    model.fabCount(model.fabCount() + 1);
    if (queue && (model.fabCount() === 1)) {
      var shiftWatch = function (keyEvent) {
        if (!keyEvent.shiftKey) {
          $('body').off('keyup', shiftWatch);
          if (self.mode() === 'fab')
            self.endFabMode();
          else if (self.mode() === 'fab_rotate')
            self.mode('fab_end');
        }
      };
      $('body').on('keyup', shiftWatch);
    }
    var beginFabX = mdevent.offsetX;
    var beginFabY = mdevent.offsetY;
    var beginSnap = !mdevent.ctrlKey;
    holodeck.unitBeginFab(beginFabX, beginFabY, beginSnap);
    self.mode('fab_rotate');
    input.capture(holodeck.div, function (event) {
      if ((event.type === 'mouseup') && (event.button === mdevent.button)) {
        var snap = !event.ctrlKey;
        holodeck.unitEndFab(event.offsetX, event.offsetY, queue, snap).then(function (success) {
          holodeck.showCommandConfirmation("", event.offsetX, event.offsetY);
          if (success)
            api.audio.playSound("/SE/UI/UI_Building_place");
        });
        queue &= (self.mode() !== 'fab_end');
        self.mode('fab');
        input.release();
        if (!queue)
          self.endFabMode();
      }
      else if ((event.type === 'keydown') && (event.keyCode === keyboard.esc)) {
        input.release();
        holodeck.unitCancelFab();
        self.endFabMode();
      }
    });
  }

  var holodeckOnSelect = function (wasSelected, prevSelection, promise) {
    return promise.then(function (selection) {
      if (selection) {
        var jSelection = JSON.parse(selection);
        self.parseSelection(jSelection);
        self.playSelectionSound(wasSelected, prevSelection, self.hasSelection(), self.selection());
        return jSelection;
      }
      else
        return null;
    });
  };

  self.celestialTargetDown = function(holodeck, mdevent) {
    if (model.celestialControlModel.findingTargetPlanet()) {
      model.celestialControlModel.mousedown(mdevent);

      input.capture($('body'), function (event) {
        if (event.type === 'mouseup' && event.button === mdevent.button) {
          model.celestialControlModel.mouseup(event);
          input.release();
        }
      });
    }
  }

  self.selectDown = function(holodeck, mdevent) {
    var startx = mdevent.offsetX;
    var starty = mdevent.offsetY;
    var dragging = false;
    var now = new Date().getTime();
    if (holodeck.hasOwnProperty('doubleClickId') && (now < holodeck.doubleClickTime)) {
      holodeckOnSelect(self.hasSelection(), self.selection(),
                       holodeck.selectMatchingUnits(getSelectOption(mdevent), [holodeck.doubleClickId])
                      );
                      delete holodeck.doubleClickTime;
                      delete holodeck.doubleClickId;
    }
    else {
      self.mode('select');

      var wasSelected = model.hasSelection();
      var prevSelection = model.selection();

      holodeck.doubleClickTime = now + 250;
      delete holodeck.doubleClickId;
      input.capture(holodeck.div, function (event) {
        if (!dragging && (event.type === 'mousemove')) {
          dragging = true;
          holodeck.beginDragSelect(startx, starty);
          delete holodeck.doubleClickTime;
        }
        else if ((event.type === 'mouseup') && (event.button === mdevent.button)) {

          input.release();
          var option = getSelectOption(event);
          if (dragging)
            holodeckOnSelect(wasSelected, prevSelection,
                             holodeck.endDragSelect(option, { left: startx, top: starty, right: event.offsetX, bottom: event.offsetY })
                            );
          else {
            if (self.hasWorldHoverTarget())
              holodeck.doubleClickId = self.worldHoverTarget();
            var index = (holodeck.clickOffset || 0);
            holodeckOnSelect(wasSelected, prevSelection,
                             holodeck.selectAt(option, startx, starty, index)
                            ).then(function (selection) {
                if (selection && selection.selectionResult) {
                  holodeck.doubleClickId = selection.selectionResult[0];
                  ++holodeck.clickOffset;
                  if (!selection.selectionResult.length)
                    api.camera.maybeSetFocusPlanet();

                }
              });
          }
          self.mode('default');
          holodeck.showCommandConfirmation("", event.offsetX, event.offsetY);
        }
        else if ((event.type === 'keydown') && (event.keyCode === keyboard.esc)) {
          input.release();
          holodeck.endDragSelect('cancel');
          self.mode('default');
        }
      });
    }
  }

  self.contextualActionDown = function(holodeck, mdevent) {
    if (self.showTimeControls()) return false
    if (self.celestialControlActive()) return false

    var startx = mdevent.offsetX;
    var starty = mdevent.offsetY;
    var dragCommand = "";
    // TODO: Consider changing this once we have event timestamps.
    // WLott is concerned that framerate dips will cause this to be wonky.
    var now = new Date().getTime();
    var dragTime = now + 75;
    var queue = mdevent.shiftKey;

    input.capture(holodeck.div, function (event) {
      var eventTime = new Date().getTime();
      if (self.showTimeControls())
        self.endCommandMode();

      if (dragCommand === "" && event.type === 'mousemove' && eventTime >= dragTime) {
        holodeck.unitBeginGo(startx, starty, model.allowCustomFormations()).then( function(ok) {
          dragCommand = ok;
          if (dragCommand)
            self.mode("command_" + dragCommand);
        } );
      }
      else if ((event.type === 'mouseup') && (event.button === mdevent.button)) {
        input.release();
        if (dragCommand === 'move') {
          holodeck.unitChangeCommandState(dragCommand,
                                          event.offsetX,
                                          event.offsetY,
                                          queue).then(function (success) {
            if (!success)
              return;

            input.capture(holodeck.div, function (event) {
              if ((event.type === 'mousedown') && (event.button === mdevent.button)) {
                input.release();
                holodeck.unitEndCommand(dragCommand, event.offsetX, event.offsetY, queue).then(function (success) {
                  holodeck.showCommandConfirmation(success ? dragCommand : "", event.offsetX, event.offsetY);
                });
                self.mode('default');
              }
              else if ((event.type === 'keydown') && (event.keyCode === keyboard.esc)) {
                input.release();
                holodeck.unitCancelCommand();
                self.mode('default');
              }
            });
            return;
          });
        }
        else if (dragCommand !== "") {
          holodeck.unitEndCommand(dragCommand, event.offsetX, event.offsetY, queue).then(function (success) {
            holodeck.showCommandConfirmation(success ? dragCommand : "", event.offsetX, event.offsetY);
            if (!success)
              return;
            var action = dragCommand.charAt(0).toUpperCase() + dragCommand.slice(1);
            api.audio.playSound("/SE/UI/UI_Command_" + action);
          });
        }
        else {
          holodeck.unitGo(startx, starty, queue).then(function (action) {
            holodeck.showCommandConfirmation(action, event.offsetX, event.offsetY);
            if (!action || (action === 'move')) {
              // Note: move currently plays its own sound.
              return;
            }
            var action = action.charAt(0).toUpperCase() + action.slice(1);
            api.audio.playSound("/SE/UI/UI_Command_" + action);
          });
          self.mode('default');
        }
      }
      else if ((event.type === 'keydown') && (event.keyCode === keyboard.esc)) {
        input.release();
        holodeck.unitCancelCommand();
        self.mode('default');
      }
    });

    return true;
  }

  self.commandModeDown = function(holodeck, mdevent, command, targetable) {
    engine.call('camera.cameraMaybeSetFocusPlanet');
    var startx = mdevent.offsetX;
    var starty = mdevent.offsetY;
    var dragging = false;
    // TODO: Consider changing this once we have event timestamps.
    // WLott is concerned that framerate dips will cause this to be wonky.
    var now = new Date().getTime();
    var dragTime = now + 125;
    var queue = mdevent.shiftKey;
    model.cmdQueueCount(model.cmdQueueCount() + 1);
    if (queue && (model.cmdQueueCount() === 1)) {
      var shiftWatch = function (keyEvent) {
        if (!keyEvent.shiftKey) {
          $('body').off('keyup', shiftWatch);
          self.endCommandMode();
        }
      };
      $('body').on('keyup', shiftWatch);
    }

    input.capture(holodeck.div, function (event) {
      var playSound = function (success) {
        holodeck.showCommandConfirmation(success ? command : "", event.offsetX, event.offsetY);
        if (!success || (command === 'move')) {
          // Note: move currently plays its own sound.
          return;
        }
        var action = command.charAt(0).toUpperCase() + command.slice(1);
        api.audio.playSound("/SE/UI/UI_Command_" + action);
      };

      var eventTime = new Date().getTime();

      if (!model.allowCustomFormations() && (command === 'move' || command === 'unload')) {
        input.release();
        holodeck.unitCommand(command, mdevent.offsetX, mdevent.offsetY, queue).then(playSound);
        if (!queue)
          self.endCommandMode();
      }
      else if (!dragging && event.type === 'mousemove' && eventTime >= dragTime) {
        holodeck.unitBeginCommand(command, startx, starty).then(function (ok) { dragging = ok; });
      }
      else if ((event.type === 'mouseup') && (event.button === mdevent.button)) {
        input.release();
        if (dragging && (command === 'move' || command === 'unload')) {
          holodeck.unitChangeCommandState(command, event.offsetX, event.offsetY, queue).then(function (success) {
            if (!success)
              return;
            // move and unload have extra input for their area command so recapture for it
            input.capture(holodeck.div, function (event) {
              if ((event.type === 'mousedown') && (event.button === mdevent.button)) {
                input.release();
                holodeck.unitEndCommand(command, event.offsetX, event.offsetY, queue).then(playSound);
                if (!queue)
                  self.endCommandMode();
              }
              else if ((event.type === 'keydown') && (event.keyCode === keyboard.esc)) {
                input.release();
                holodeck.unitCancelCommand();
                self.mode('command_' + command);
              }
            });
          });
        }
        else if (dragging) {
          holodeck.unitEndCommand(command, event.offsetX, event.offsetY, queue).then(function (success) {
            holodeck.showCommandConfirmation(success ? command : "", event.offsetX, event.offsetY);
            if (!success)
              return;
            var action = command.charAt(0).toUpperCase() + command.slice(1);
            api.audio.playSound("/SE/UI/UI_Command_" + action);
          });
          if (!queue)
            self.endCommandMode();
        }
        else {
          if (self.hasWorldHoverTarget() && targetable) {
            api.unit.targetCommand(command, self.worldHoverTarget(), queue).then(playSound);
          }
          else {
            holodeck.unitCommand(command, mdevent.offsetX, mdevent.offsetY, queue).then(playSound);
          }

          if (!queue)
            self.endCommandMode();
        }
      }
      else if ((event.type === 'keydown') && (event.keyCode === keyboard.esc)) {
        input.release();
        holodeck.unitCancelCommand();
        self.mode('command_' + command);
      }
    });
  }

  self.holdMousePan = function(holodeck, mdevent) {
    var oldMode = self.mode();
    self.mode('camera');
    holodeck.beginControlCamera();
    input.capture(holodeck.div, function (event) {
      var mouseDone = ((event.type === 'mouseup') && (event.button === mdevent.button));
      var escKey = ((event.type === 'keydown') && (event.keyCode === keyboard.esc));
      if (mouseDone || escKey) {
        input.release();
        holodeck.endControlCamera();
        if (self.mode() === 'camera')
          self.mode(oldMode);
      }
    });
  }

  self.holodeckModeMouseDown = {};

  self.holodeckModeMouseDown.fab = function (holodeck, mdevent) {
    console.log('my holodeckModeMouseDown.fab')
    if (mdevent.button === 0) {
      self.beginFabDown(holodeck, mdevent)
      return true;
    }
    else if (mdevent.button === 2) {
      self.endFabMode();
      return true;
    }
    return false;
  };

  self.holodeckModeMouseDown['default'] = function (holodeck, mdevent) {
    console.log('my holodeckModeMouseDown.default')
    if (mdevent.button === 0) {
      if (model.celestialControlActive()) {
        self.celestialTargetDown(holdeck, mdevent)
      } else {
        self.selectDown(holodeck, mdevent)
      }
      return true;
    }
    else if (mdevent.button === 2) {
      return self.contextualActionDown(holodeck, mdevent)
    }
    return false;
  };

  var holodeckCommandMouseDown = function (command, targetable) {
    return function (holodeck, mdevent) {
      console.log('my holodeckCommandMouseDown', command)
      if (mdevent.button === 0) {
        self.commandModeDown(holodeck, mdevent, command, targetable)
        return true;
      }
    };
  };

  for (var i = 0; i < self.commands().length; ++i) {
    var command = self.commands()[i];
    var targetable = self.targetableCommands()[i];
    self.holodeckModeMouseDown['command_' + command] = holodeckCommandMouseDown(command, targetable);
  }

  //  :-( :-( :-(
  $('holodeck').off('mousedown')

  $('holodeck').mousedown(function (mdevent) {
    console.log('my $holodeck.mousedown')
    if (mdevent.target.nodeName !== 'HOLODECK')
      return;

    var holodeck = api.Holodeck.get(this);

    var handler = self.holodeckModeMouseDown[self.mode()];
    if (handler && handler(holodeck, mdevent)) {
      mdevent.preventDefault();
      mdevent.stopPropagation();
      return;
    }

    if (mdevent.button === 1) { // middle click
      self.holdMousePan(holodeck, mdevent)
      mdevent.preventDefault();
      mdevent.stopPropagation();
      return;
    }

    if (mdevent.button === 2 && self.mode() !== 'default') { // right click
      self.endCommandMode()
    }
  });
})()
