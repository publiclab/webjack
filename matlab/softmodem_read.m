function softmodem_read(filename, baudrate, eventlength)
	FREQ_LOW = 1575;
	FREQ_HIGH = 3150;
	windowsize = 16;
	
	%% s → time domain
	%% y → frequency domain

	[s, fs] = audioread(filename);

	%% normalization
	s = s/max(s); 

	data = [];

	%% decode in chunks of length = eventlength
	% m = ceil(length(s)/eventlength);
	% l = m*eventlength;
	% s = reshape(resize(s,l,1), eventlength, m);

	% state = 1;
	% for n = 1 : 1 : columns(s)
	% 	[corr_diff, corr_low, corr_high] = demod(s(:,n), fs, windowsize, FREQ_LOW, FREQ_HIGH, baudrate);
	% 	[data, state] = decodeFrame(corr_diff, fs, data, state, baudrate);
	% end

	%% decode all at once
	[corr_diff, corr_low, corr_high] = demod(s, fs, windowsize, FREQ_LOW, FREQ_HIGH, baudrate);
	[data, state] = decodeAll(corr_diff, fs, baudrate);

	%% result
	disp(char(data));

	%% plots
	% fftplots(s, x_filt, fs);
	plots(s, corr_low, corr_high, corr_diff);

end


function [event,c_l,c_h] = demod(s, fs, windowsize, f_low, f_high, baud)
	event = zeros(size(s));
	fnyquist = fs/2;
	
	%% filtering
	cutoff_low = f_low*0.8/fnyquist;
	cutoff_high = f_high*1.2/fnyquist;
	[b,a] = butter(1, [cutoff_low, cutoff_high]);
	s_filt = filter(b,a,s);
	
	%% correlation with lower and upper frequency
	%% TODO cyclic prefix and appendix
	c_l = correlate(s, f_low, fs, windowsize);
	c_h = correlate(s, f_high, fs, windowsize);
	

	%% difference of the correlations = recovered signal
	%% filtering signals with f > baudrate
	cutoff_high = baud/fnyquist;
	[b,a] = butter(1, cutoff_high);
	corr_diff = c_h - c_l;
	corr_diff = filter(b,a, corr_diff);
	corr_diff /= max(corr_diff);

	event = corr_diff;
end

function [data, state] = decodeAll(s, fs, baud)
	disp(sprintf('Decoding frame with length %d, baudrate %d:',length(s), baud));
	data = [];
	[data, state] = decodeFrame(s,fs, [], 1, baud);
end

function [data, state] = decodeFrame(s, fs, partial_data, prev_state, baud)
	DEBUG = true;
	FLAG = 1; START = 2; DATA = 3; STOP = 4; PUSH = 5;
	
	data = [partial_data];
	state = prev_state;

	samples_per_bit = fs/baud;
	spb_th_low = samples_per_bit*0.8;
	max_preamble_spl = 49*samples_per_bit;

	bit_count = 0;
	flag_counter = 0;
	c = 1;
	byte = 0;
	while c < length(s)
		switch (state)
			case FLAG
				if s(c) > 0.5
					flag_counter++;
				elseif (flag_counter < spb_th_low) || (flag_counter > max_preamble_spl)
					flag_counter = 0;
				else
					state = START;
					flag_counter = 0;
					c += floor(samples_per_bit/2) - 1;
				end
			case START
				if DEBUG disp(sprintf('%d START', c)); end
				if s(c) > 0.5
					state = FLAG;
				else
					state = DATA;
					byte = 0;
					c += samples_per_bit - 1;
				end
			case DATA
				if DEBUG disp(sprintf('%d DATA', c)); end
				bit = int8(s(c) > 0.5);
				byte = bitor(byte, bitshift(bit, bit_count));
				if bit_count < 7
					bit_count++;
				else
					bit_count = 0;
					state = STOP;
				end
				c += samples_per_bit - 1;
			case STOP
				if DEBUG disp(sprintf('%d STOP', c)); end
				if s(c) > 0.5
					data = [data byte];
					state = PUSH;
				else
					state = FLAG;
				end
				c += samples_per_bit - 1;
			case PUSH
				if DEBUG disp(sprintf('%d PUSH', c)); end
				if s(c) > 0.5
					state = FLAG;
					data = [data 0x0A];
				else
					c += floor(samples_per_bit/2) -1;
					state = START;
				end
				c += floor(samples_per_bit/2) - 1;
			otherwise
				if DEBUG disp(sprintf('%d OTHER', c)); end
				state = FLAG;
				flag_counter = 0;
				bit_count = 0;
				byte = 0;
		end
		c++;
	end
end


function correlated = correlate(s, f, fs, windowsize)
	correlated = zeros(size(s));
	sinus = sin(2*pi*f*(0:1/fs:windowsize/fs)).';
	cosinus = cos(2*pi*f*(0:1/fs:windowsize/fs)).';

	for c = 1:1:(length(s) - windowsize)
		range = c : c+windowsize;
		correlated(range) += sqrt( sum(s(range).*sinus)**2 + sum(s(range).*cosinus)**2 );
	end
end


function fftplots(s, s_filtered, fs)
	fftplot = @(s, fs) plot(linspace(0,fs/2,length(s)/2), s(length(s)/2 +1 : end));
	
	y = abs(fftshift(fft(s)));
	y /= max(y);

	y_filt = abs(fftshift(fft(s_filtered)));
	y_filt /= max(y_filt);

	figure 1
	subplot(2,1,1)
	fftplot(y, fs);
	title(sprintf('Frequency domain'))


	subplot(2,1,2)
	fftplot(y_filt, fs);
	title(sprintf('Frequency domain (filtered)'))
end

function plots(s, corr_l, corr_h, corr_diff)
	figure 2
	subplot(4,1,1)
	plot(s);
	title(sprintf('Input signal'))
	
	subplot(4,1,2)
	plot(corr_l);
	title(sprintf('Correlation with 1200 Hz'))

	subplot(4,1,3)
	plot(corr_h);
	title(sprintf('Correlation with 2200 Hz'))

	subplot(4,1,4)
	plot(corr_diff);
	title(sprintf('Normalized difference of the correlated signals'))
end