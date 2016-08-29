function softmodem_read(filename, baudrate, freq_l, freq_h)
	[s, fs] = audioread(filename);
	%% s → time domain
	%% y → frequency domain

	%% time before decoding
	starttime = time;

	%% normalization
	s = s/max(s); 

	%% window for correlation 
	windowsize = 8;

	%% demod and decode
	[corr_diff, corr_low, corr_high] = demod(s, fs, windowsize, freq_l, freq_h, baudrate);
	data = decode(corr_diff, fs, baudrate);
	

	%% time after decoding
	endttime = time;

	%% result
	disp(char(data));
	disp(sprintf('Decoded in %f seconds', endttime -starttime));

	%% plots
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
	c_l = correlate(s_filt, f_low, fs, windowsize);
	c_h = correlate(s_filt, f_high, fs, windowsize);
	

	%% difference of the correlations = recovered signal
	%% filtering signals with f > baudrate
	% cutoff_high = baud/fnyquist;
	% [b,a] = butter(1, cutoff_high);
	corr_diff = c_h - c_l;
	% corr_diff = filter(b,a, corr_diff);	% resulting signal looks better without filtering
	corr_diff /= max(corr_diff);

	event = corr_diff;
	% fftplots(s, s_filt, fs);
end

function data = decode(s, fs, baud)
	DEBUG = false;
	disp(sprintf('Decoding frame with length %d:',length(s)));

	PREAMBLE = 1; START = 2; DATA = 3; STOP = 4; PUSH = 5;
	state = 1;
	
	data = [];

	samples_per_bit = fs/baud;
	min_preamble_spls = 10*samples_per_bit; %*0.8;
	max_preamble_spls = 49*samples_per_bit;

	bit_count = 0;
	flag_counter = 0;
	c = 1;
	byte = 0;

	while c < length(s)
		switch (state)
			case PREAMBLE
				if s(c) > 0.5
					flag_counter++;
				elseif (flag_counter < min_preamble_spls) || (flag_counter > max_preamble_spls)
					flag_counter = 0;
				else
					state = START;
					flag_counter = 0;
					c += floor(samples_per_bit/2) - 1;
				end
			case START
				if DEBUG disp(sprintf('%d START', c)); end
				if s(c) > 0
					state = PREAMBLE;
				else
					state = DATA;
					byte = 0;
					c += samples_per_bit - 1;
				end
			case DATA
				if DEBUG disp(sprintf('%d DATA', c)); end
				bit = int8(s(c) > 0);
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
				if s(c) > 0
					data = [data byte];
					state = START;
				else
					state = PREAMBLE;
				end
				c += samples_per_bit - 1;
			otherwise
				if DEBUG disp(sprintf('%d OTHER', c)); end
				state = PREAMBLE;
				flag_counter = 0;
				bit_count = 0;
				byte = 0;
		end
		c++;
	end
end


function correlated = correlate(s, f, fs, windowsize)
	correlated = zeros(size(s));

	phase = 2*pi * f * (0 : 1/fs : windowsize/fs);
	sinus = sin(phase).';
	cosinus = cos(phase).';

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
	title(sprintf('Correlation with FREQ\\_LOW'))

	subplot(4,1,3)
	plot(corr_h);
	title(sprintf('Correlation with FREQ\\_HIGH'))

	subplot(4,1,4)
	plot(corr_diff);
	title(sprintf('Demodulated signal'))
end